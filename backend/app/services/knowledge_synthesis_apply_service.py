import logging
import uuid
from datetime import datetime, timezone

from fastapi import (
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.models.interview_analysis import (
    InterviewAnalysis,
    KnowledgeCandidate,
)
from app.models.interview_message import (
    InterviewMessage,
)
from app.models.knowledge_core import (
    Evidence,
    KnowledgeRelation,
    KnowledgeUnit,
)
from app.models.knowledge_synthesis import (
    KnowledgeSynthesis,
    KnowledgeSynthesisRelation,
    KnowledgeSynthesisUnit,
)
from app.schemas.knowledge_synthesis_apply import (
    AppliedKnowledgeUnit,
    KnowledgeSynthesisValidationRequest,
    KnowledgeSynthesisValidationResponse,
)
from app.services.knowledge_duplicate_service import (
    assess_synthesized_unit_material_change,
    find_duplicate_active_knowledge,
)


logger = logging.getLogger(__name__)


PERSISTENT_VERSION_RELATION_TYPES = {
    "HAS_EXCEPTION",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _candidate_snapshot_mismatch_fields(
    synthesis: KnowledgeSynthesis,
    candidate: KnowledgeCandidate,
) -> list[str]:
    """
    Compare the immutable candidate snapshot stored in
    synthesis.request_payload with the current candidate.

    A synthesis created before a Review Edit must never be
    applied after the candidate has changed.  This guard is
    intentionally independent from synthesis.status so that
    even a stale synthesis whose status is accidentally reset
    cannot be applied.
    """

    request_payload = synthesis.request_payload or {}
    snapshot = request_payload.get("candidate")

    if not isinstance(snapshot, dict):
        # Legacy synthesis rows may not have a candidate snapshot.
        # Keep backward compatibility for those rows.
        return []

    current = {
        "statement": candidate.statement,
        "type": candidate.knowledge_type,
        "context": candidate.context or {},
        "decision_rule": candidate.decision_rule,
        "rationale": candidate.rationale,
        "exception": candidate.exception,
    }

    mismatches: list[str] = []

    for key, current_value in current.items():
        if snapshot.get(key) != current_value:
            mismatches.append(key)

    return mismatches


def _mark_synthesis_stale_for_target_change(
    db: Session,
    synthesis: KnowledgeSynthesis,
    candidate: KnowledgeCandidate,
    target_ids: list[uuid.UUID],
    validated_by: str | None,
    now: datetime,
) -> None:
    """
    Human Review가 대기하는 동안 다른 Candidate가 먼저 승인되어
    Synthesis가 참조하던 target Knowledge가 SUPERSEDED/RETIRED가
    된 경우 기존 Synthesis를 그대로 적용하지 않는다.

    Candidate는 REVIEW_REQUIRED 상태를 유지하고 synthesis 연결만
    해제하여 Frontend가 재-Synthesis 후 다시 검토할 수 있게 한다.
    """

    target_text = ",".join(str(value) for value in target_ids)

    synthesis.status = "STALE"
    synthesis.validated_by = (
        validated_by
        or "K-DNA TARGET VERSION GUARD"
    )
    synthesis.validation_reason = (
        "Target knowledge changed after synthesis creation; "
        "re-synthesis is required. target_knowledge_ids="
        + target_text
    )
    synthesis.validated_at = now

    if candidate.review_status == "REVIEW_REQUIRED":
        candidate.review_synthesis_id = None
        candidate.review_reason = (
            "Target knowledge changed while this candidate was "
            "waiting for review; re-synthesis is required"
        )

    db.commit()
    db.refresh(synthesis)
    db.refresh(candidate)



def _datetime_timestamp(
    value: datetime | None,
) -> float | None:
    if value is None:
        return None

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    return value.timestamp()


def _find_newer_applied_sibling_synthesis(
    db: Session,
    candidate: KnowledgeCandidate,
    synthesis: KnowledgeSynthesis,
) -> KnowledgeSynthesis | None:
    """
    현재 Synthesis가 생성된 뒤 같은 InterviewAnalysis의 다른 Candidate가
    먼저 APPROVE/APPLIED 되었는지 확인한다.

    post-apply sibling invalidation이 배포되기 전에 만들어진 기존 대기건,
    혹은 동시에 진행된 Review처럼 STALE 플래그가 아직 반영되지 않은
    경우에도 APPROVE 직전 한 번 더 graph snapshot freshness를 검증한다.
    """

    sibling_candidates = (
        db.query(KnowledgeCandidate)
        .filter(
            KnowledgeCandidate.analysis_id
            == candidate.analysis_id,
            KnowledgeCandidate.candidate_id
            != candidate.candidate_id,
        )
        .all()
    )

    if not sibling_candidates:
        return None

    sibling_candidate_ids = [
        row.candidate_id
        for row in sibling_candidates
    ]

    applied_syntheses = (
        db.query(KnowledgeSynthesis)
        .filter(
            KnowledgeSynthesis.candidate_id.in_(
                sibling_candidate_ids
            ),
            KnowledgeSynthesis.synthesis_id
            != synthesis.synthesis_id,
            KnowledgeSynthesis.status
            == "APPLIED",
        )
        .all()
    )

    synthesis_created_at = _datetime_timestamp(
        synthesis.created_at
    )

    newer_rows: list[tuple[float, KnowledgeSynthesis]] = []

    for applied in applied_syntheses:
        applied_at = _datetime_timestamp(
            applied.applied_at
        )

        if applied_at is None:
            continue

        if (
            synthesis_created_at is not None
            and applied_at <= synthesis_created_at
        ):
            continue

        newer_rows.append(
            (
                applied_at,
                applied,
            )
        )

    if not newer_rows:
        return None

    newer_rows.sort(
        key=lambda item: item[0],
        reverse=True,
    )

    return newer_rows[0][1]

def _mark_synthesis_stale_for_graph_change(
    synthesis: KnowledgeSynthesis,
    candidate: KnowledgeCandidate,
    applied_synthesis_id: uuid.UUID,
    validated_by: str | None,
    now: datetime,
) -> None:
    """
    같은 InterviewAnalysis에서 다른 Candidate가 먼저 승인되어
    Knowledge Graph가 변경된 경우, 아직 대기 중인 Synthesis는
    생성 당시의 graph snapshot에 기반하므로 그대로 적용하지 않는다.

    특히 target/existing_knowledge가 없었던 MERGE도 graph가 비어 있던
    시점에 만들어졌다면 이후 첫 Knowledge가 승인된 순간 판단 전제가
    달라진다. 따라서 PENDING/APPROVED Synthesis를 STALE 처리하고
    Candidate는 REVIEW_REQUIRED 상태로 유지한 채 재-Synthesis를 요구한다.

    이 함수는 transaction을 commit하지 않는다. 현재 APPROVE와 sibling
    invalidation이 하나의 transaction으로 함께 성공/rollback되게 한다.
    """

    if synthesis.status not in {
        "PENDING",
        "APPROVED",
    }:
        return

    synthesis.status = "STALE"
    synthesis.validated_by = (
        validated_by
        or "K-DNA ANALYSIS SNAPSHOT GUARD"
    )
    synthesis.validation_reason = (
        "Knowledge graph changed after synthesis creation because "
        "another candidate from the same interview analysis was "
        "approved; re-synthesis is required. "
        f"applied_synthesis_id={applied_synthesis_id}"
    )
    synthesis.validated_at = now

    if candidate.review_status == "REVIEW_REQUIRED":
        if (
            candidate.review_synthesis_id is None
            or str(candidate.review_synthesis_id)
            == str(synthesis.synthesis_id)
        ):
            candidate.review_synthesis_id = None

        candidate.review_reason = (
            "Knowledge graph changed while this candidate was "
            "waiting for review; re-synthesis is required"
        )


def _mark_waiting_syntheses_stale_after_graph_change(
    db: Session,
    analysis_id: uuid.UUID,
    applied_candidate_id: uuid.UUID,
    applied_synthesis_id: uuid.UUID,
    validated_by: str | None,
    now: datetime,
) -> int:
    """
    현재 승인으로 Knowledge Graph가 실제 변경된 뒤,
    같은 analysis에서 먼저 만들어져 대기 중인 다른 Candidate의
    PENDING/APPROVED Synthesis를 모두 STALE 처리한다.

    같은 답변에서 여러 Candidate가 동시에 Synthesis되었더라도
    Human Review 승인 순서대로 최신 Graph를 다시 반영하게 하여
    targetless MERGE, 오래된 target, 누락 relation을 방지한다.
    """

    sibling_candidates = (
        db.query(KnowledgeCandidate)
        .filter(
            KnowledgeCandidate.analysis_id
            == analysis_id,
            KnowledgeCandidate.candidate_id
            != applied_candidate_id,
        )
        .all()
    )

    if not sibling_candidates:
        return 0

    candidate_map = {
        row.candidate_id: row
        for row in sibling_candidates
    }
    sibling_candidate_ids = list(candidate_map.keys())

    waiting_syntheses = (
        db.query(KnowledgeSynthesis)
        .filter(
            KnowledgeSynthesis.candidate_id.in_(
                sibling_candidate_ids
            ),
            KnowledgeSynthesis.synthesis_id
            != applied_synthesis_id,
            KnowledgeSynthesis.status.in_(
                ("PENDING", "APPROVED")
            ),
        )
        .all()
    )

    stale_count = 0

    for waiting_synthesis in waiting_syntheses:
        sibling_candidate = candidate_map.get(
            waiting_synthesis.candidate_id
        )

        if sibling_candidate is None:
            continue

        _mark_synthesis_stale_for_graph_change(
            synthesis=waiting_synthesis,
            candidate=sibling_candidate,
            applied_synthesis_id=applied_synthesis_id,
            validated_by=validated_by,
            now=now,
        )
        stale_count += 1

    if stale_count:
        db.flush()

        logger.info(
            (
                "Marked %s waiting sibling syntheses STALE after "
                "knowledge graph change analysis_id=%s "
                "applied_candidate_id=%s applied_synthesis_id=%s"
            ),
            stale_count,
            analysis_id,
            applied_candidate_id,
            applied_synthesis_id,
        )

    return stale_count


def _find_newer_applied_mission_graph_synthesis(
    db: Session,
    synthesis: KnowledgeSynthesis,
) -> KnowledgeSynthesis | None:
    """
    현재 Synthesis 생성 이후 같은 Mission에서 실제 Knowledge Unit을
    생성한 다른 APPLIED Synthesis가 있는지 확인한다.

    No-op reuse는 APPLIED 상태가 되더라도 새 Knowledge Unit을 만들지
    않으므로 graph change로 취급하지 않는다.
    """

    created_at = synthesis.created_at

    rows = (
        db.query(KnowledgeSynthesis)
        .filter(
            KnowledgeSynthesis.mission_id
            == synthesis.mission_id,
            KnowledgeSynthesis.synthesis_id
            != synthesis.synthesis_id,
            KnowledgeSynthesis.status == "APPLIED",
            KnowledgeSynthesis.applied_at.isnot(None),
        )
        .order_by(KnowledgeSynthesis.applied_at.desc())
        .all()
    )

    synthesis_created_ts = _datetime_timestamp(created_at)

    for applied in rows:
        applied_ts = _datetime_timestamp(applied.applied_at)

        if applied_ts is None:
            continue

        if (
            synthesis_created_ts is not None
            and applied_ts <= synthesis_created_ts
        ):
            continue

        created_knowledge = (
            db.query(KnowledgeUnit)
            .filter(
                KnowledgeUnit.source_synthesis_id
                == applied.synthesis_id
            )
            .first()
        )

        if created_knowledge is not None:
            return applied

    return None


def _mark_waiting_mission_syntheses_stale_after_graph_change(
    db: Session,
    mission_id: uuid.UUID,
    applied_candidate_id: uuid.UUID,
    applied_synthesis_id: uuid.UUID,
    validated_by: str | None,
    now: datetime,
) -> int:
    """
    Knowledge Graph가 실제 변경되면 같은 Mission에서 이미 만들어져
    대기 중인 모든 PENDING/APPROVED Synthesis를 STALE 처리한다.

    Analysis 경계를 넘어 stale snapshot 적용을 차단하기 위한 guard다.
    """

    mission_candidate_rows = (
        db.query(KnowledgeCandidate)
        .join(
            InterviewAnalysis,
            InterviewAnalysis.analysis_id
            == KnowledgeCandidate.analysis_id,
        )
        .filter(
            InterviewAnalysis.mission_id == mission_id,
            KnowledgeCandidate.candidate_id
            != applied_candidate_id,
        )
        .all()
    )

    if not mission_candidate_rows:
        return 0

    candidate_map = {
        row.candidate_id: row
        for row in mission_candidate_rows
    }

    waiting_syntheses = (
        db.query(KnowledgeSynthesis)
        .filter(
            KnowledgeSynthesis.mission_id == mission_id,
            KnowledgeSynthesis.candidate_id.in_(
                list(candidate_map.keys())
            ),
            KnowledgeSynthesis.synthesis_id
            != applied_synthesis_id,
            KnowledgeSynthesis.status.in_(
                ("PENDING", "APPROVED")
            ),
        )
        .all()
    )

    stale_count = 0

    for waiting_synthesis in waiting_syntheses:
        candidate = candidate_map.get(
            waiting_synthesis.candidate_id
        )

        if candidate is None:
            continue

        _mark_synthesis_stale_for_graph_change(
            synthesis=waiting_synthesis,
            candidate=candidate,
            applied_synthesis_id=applied_synthesis_id,
            validated_by=validated_by,
            now=now,
        )
        stale_count += 1

    if stale_count:
        db.flush()

        logger.info(
            (
                "Marked %s waiting mission syntheses STALE after "
                "knowledge graph change mission_id=%s "
                "applied_candidate_id=%s applied_synthesis_id=%s"
            ),
            stale_count,
            mission_id,
            applied_candidate_id,
            applied_synthesis_id,
        )

    return stale_count


def _mark_synthesis_stale_for_policy_violation(
    db: Session,
    synthesis: KnowledgeSynthesis,
    candidate: KnowledgeCandidate,
    reason: str,
    validated_by: str | None,
    now: datetime,
) -> None:
    synthesis.status = "STALE"
    synthesis.validated_by = (
        validated_by
        or "K-DNA KNOWLEDGE POLICY GUARD"
    )
    synthesis.validation_reason = reason
    synthesis.validated_at = now

    if candidate.review_status == "REVIEW_REQUIRED":
        candidate.review_synthesis_id = None
        candidate.review_reason = (
            f"{reason}; re-synthesis is required"
        )

    db.commit()
    db.refresh(synthesis)
    db.refresh(candidate)


def _get_targets(
    db: Session,
    synthesis: KnowledgeSynthesis,
) -> list[KnowledgeUnit]:

    target_ids = [
        uuid.UUID(str(value))
        for value in (
            synthesis.target_knowledge_ids or []
        )
    ]

    if not target_ids:
        return []

    rows = (
        db.query(KnowledgeUnit)
        .filter(
            KnowledgeUnit.knowledge_id.in_(
                target_ids
            )
        )
        .all()
    )

    row_map = {
        row.knowledge_id: row
        for row in rows
    }

    result = []

    for target_id in target_ids:

        row = row_map.get(target_id)

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Synthesis target knowledge "
                    f"not found: {target_id}"
                ),
            )

        if row.mission_id != synthesis.mission_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Synthesis target belongs "
                    "to another mission"
                ),
            )

        result.append(row)

    return result


def _add_relation_if_missing(
    db: Session,
    mission_id: uuid.UUID,
    source_id: uuid.UUID,
    target_id: uuid.UUID,
    relation_type: str,
    source_analysis_id: uuid.UUID | None,
    confidence_score: float = 1.0,
) -> None:

    if source_id == target_id:
        return

    existing = (
        db.query(KnowledgeRelation)
        .filter(
            KnowledgeRelation.from_knowledge_id
            == source_id,
            KnowledgeRelation.to_knowledge_id
            == target_id,
            KnowledgeRelation.relation_type
            == relation_type,
        )
        .first()
    )

    if existing is not None:
        return

    db.add(
        KnowledgeRelation(
            mission_id=mission_id,
            from_knowledge_id=source_id,
            to_knowledge_id=target_id,
            relation_type=relation_type,
            confidence_score=confidence_score,
            source_analysis_id=(
                source_analysis_id
            ),
        )
    )


def _collect_persistent_relation_inheritance_specs(
    old_knowledge_id: uuid.UUID,
    new_knowledge_id: uuid.UUID,
    relations: list[KnowledgeRelation],
) -> list[
    tuple[
        uuid.UUID,
        uuid.UUID,
        str,
        uuid.UUID | None,
        float,
    ]
]:
    """
    새 Version으로 승계해야 하는 의미 관계를 pure-data 형태로 계산한다.

    현재는 HAS_EXCEPTION만 승계한다.

    예:
      old parent --HAS_EXCEPTION--> exception
      new parent --HAS_EXCEPTION--> exception

    반대로 EXCEPTION 자체가 version-up되는 경우도 지원한다.

      principle --HAS_EXCEPTION--> old exception
      principle --HAS_EXCEPTION--> new exception

    SUPERSEDES/REFINES/SUPPORTS 등은 현재 version에서 새로 판단해야 하므로
    자동 승계하지 않는다.
    """

    result: list[
        tuple[
            uuid.UUID,
            uuid.UUID,
            str,
            uuid.UUID | None,
            float,
        ]
    ] = []
    seen: set[
        tuple[
            uuid.UUID,
            uuid.UUID,
            str,
        ]
    ] = set()

    for relation in relations:
        relation_type = relation.relation_type

        if (
            relation_type
            not in PERSISTENT_VERSION_RELATION_TYPES
        ):
            continue

        if (
            relation.from_knowledge_id
            == old_knowledge_id
        ):
            source_id = new_knowledge_id
            target_id = (
                relation.to_knowledge_id
            )

        elif (
            relation.to_knowledge_id
            == old_knowledge_id
        ):
            source_id = (
                relation.from_knowledge_id
            )
            target_id = new_knowledge_id

        else:
            continue

        if source_id == target_id:
            continue

        key = (
            source_id,
            target_id,
            relation_type,
        )

        if key in seen:
            continue

        seen.add(key)

        confidence = (
            float(relation.confidence_score)
            if relation.confidence_score
            is not None
            else 1.0
        )

        result.append(
            (
                source_id,
                target_id,
                relation_type,
                relation.source_analysis_id,
                confidence,
            )
        )

    return result


def _inherit_persistent_relations_for_new_version(
    db: Session,
    target: KnowledgeUnit,
    new_knowledge: KnowledgeUnit,
) -> int:
    """
    ENRICH/SUPERSEDE로 새 Knowledge Version이 만들어질 때
    이전 Version에 연결되어 있던 지속 의미 관계를 새 Version으로
    승계한다.

    현재 승계 대상은 HAS_EXCEPTION뿐이다. Version/history 관계나
    SUPPORTS/CONTRADICTS/CONTEXT_DIFFERS 등은 자동 승계하지 않는다.
    """

    outgoing = (
        db.query(KnowledgeRelation)
        .filter(
            KnowledgeRelation.from_knowledge_id
            == target.knowledge_id,
            KnowledgeRelation.relation_type.in_(
                PERSISTENT_VERSION_RELATION_TYPES
            ),
        )
        .all()
    )

    incoming = (
        db.query(KnowledgeRelation)
        .filter(
            KnowledgeRelation.to_knowledge_id
            == target.knowledge_id,
            KnowledgeRelation.relation_type.in_(
                PERSISTENT_VERSION_RELATION_TYPES
            ),
        )
        .all()
    )

    specs = (
        _collect_persistent_relation_inheritance_specs(
            old_knowledge_id=(
                target.knowledge_id
            ),
            new_knowledge_id=(
                new_knowledge.knowledge_id
            ),
            relations=[
                *outgoing,
                *incoming,
            ],
        )
    )

    for (
        source_id,
        target_id,
        relation_type,
        source_analysis_id,
        confidence_score,
    ) in specs:
        _add_relation_if_missing(
            db=db,
            mission_id=target.mission_id,
            source_id=source_id,
            target_id=target_id,
            relation_type=relation_type,
            source_analysis_id=(
                source_analysis_id
            ),
            confidence_score=(
                confidence_score
            ),
        )

    if specs:
        logger.info(
            (
                "Inherited %s persistent relations "
                "for knowledge version change "
                "old_knowledge_id=%s "
                "new_knowledge_id=%s"
            ),
            len(specs),
            target.knowledge_id,
            new_knowledge.knowledge_id,
        )

    return len(specs)


def _create_evidence(
    db: Session,
    knowledge: KnowledgeUnit,
    synthesis: KnowledgeSynthesis,
    candidate: KnowledgeCandidate,
    analysis: InterviewAnalysis | None,
) -> None:

    source_message = None

    if analysis is not None:
        source_message = (
            db.query(InterviewMessage)
            .filter(
                InterviewMessage.message_id
                == analysis.source_message_id
            )
            .first()
        )

    if source_message is None:
        return

    # 같은 Interview Message가 동일 Knowledge에 이미 Evidence로
    # 누적되어 있으면 중복 row를 만들지 않는다.
    existing = (
        db.query(Evidence)
        .filter(
            Evidence.knowledge_id
            == knowledge.knowledge_id,
            Evidence.source_type
            == "INTERVIEW_MESSAGE",
            Evidence.source_id
            == str(source_message.message_id),
        )
        .first()
    )

    if existing is not None:
        return

    db.add(
        Evidence(
            knowledge_id=(
                knowledge.knowledge_id
            ),
            source_type="INTERVIEW_MESSAGE",
            source_id=str(
                source_message.message_id
            ),
            source_text=(
                source_message.content
            ),
            confidence_score=(
                candidate.confidence_score
            ),
            metadata_={
                "candidate_id": str(
                    candidate.candidate_id
                ),
                "synthesis_id": str(
                    synthesis.synthesis_id
                ),
                "analysis_id": str(
                    analysis.analysis_id
                ),
            },
        )
    )


def _create_new_unit(
    db: Session,
    synthesis: KnowledgeSynthesis,
    proposal: KnowledgeSynthesisUnit,
    source_candidate_id: uuid.UUID | None = None,
    version: int = 1,
    root_knowledge_id: uuid.UUID | None = None,
    supersedes_id: uuid.UUID | None = None,
) -> KnowledgeUnit:

    knowledge = KnowledgeUnit(
        mission_id=synthesis.mission_id,

        source_candidate_id=(
            source_candidate_id
        ),

        source_synthesis_id=(
            synthesis.synthesis_id
        ),

        source_synthesis_unit_id=(
            proposal.synthesis_unit_id
        ),

        knowledge_type=(
            proposal.knowledge_type
        ),

        statement=proposal.statement,

        context=(
            proposal.context or {}
        ),

        decision_rule=(
            proposal.decision_rule
        ),

        rationale=(
            proposal.rationale
        ),

        exception=(
            proposal.exception
        ),

        status="VERIFIED",

        confidence_score=(
            proposal.confidence_score
        ),

        version=version,

        root_knowledge_id=(
            root_knowledge_id
        ),

        supersedes_id=(
            supersedes_id
        ),

        change_reason=(
            synthesis.reason
        ),
    )

    db.add(knowledge)
    db.flush()

    proposal.validation_status = "VERIFIED"

    proposal.applied_knowledge_id = (
        knowledge.knowledge_id
    )

    return knowledge


def validate_and_apply_synthesis(
    db: Session,
    synthesis_id: uuid.UUID,
    request: KnowledgeSynthesisValidationRequest,
    material_change_embedding_cache: (
        dict[str, list[float]] | None
    ) = None,
) -> KnowledgeSynthesisValidationResponse:

    synthesis = (
        db.query(KnowledgeSynthesis)
        .filter(
            KnowledgeSynthesis.synthesis_id
            == synthesis_id
        )
        .first()
    )

    if synthesis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge synthesis not found",
        )

    if synthesis.status == "APPLIED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Knowledge synthesis has "
                "already been applied"
            ),
        )

    if synthesis.status == "REJECTED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Knowledge synthesis has "
                "already been rejected"
            ),
        )

    if synthesis.status == "STALE":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Knowledge synthesis is stale; create a new "
                "synthesis against the current candidate and "
                "knowledge graph before validation"
            ),
        )

    candidate = (
        db.query(KnowledgeCandidate)
        .filter(
            KnowledgeCandidate.candidate_id
            == synthesis.candidate_id
        )
        .first()
    )

    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge candidate not found",
        )

    analysis = (
        db.query(InterviewAnalysis)
        .filter(
            InterviewAnalysis.analysis_id
            == candidate.analysis_id
        )
        .first()
    )

    now = _utcnow()

    # ------------------------------------------------------
    # Mission-wide pre-approve graph-snapshot freshness guard
    #
    # Synthesis 생성 이후 같은 Mission에서 다른 Synthesis가 실제
    # Knowledge Unit을 생성했다면 기존 Synthesis의 target/graph 판단은
    # 오래된 snapshot이다. Analysis가 달라도 반드시 재-Synthesis한다.
    # ------------------------------------------------------
    if request.decision == "APPROVE":
        newer_mission_graph_change = (
            _find_newer_applied_mission_graph_synthesis(
                db=db,
                synthesis=synthesis,
            )
        )

        if newer_mission_graph_change is not None:
            _mark_synthesis_stale_for_graph_change(
                synthesis=synthesis,
                candidate=candidate,
                applied_synthesis_id=(
                    newer_mission_graph_change.synthesis_id
                ),
                validated_by=request.validated_by,
                now=now,
            )

            db.commit()
            db.refresh(synthesis)
            db.refresh(candidate)

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Knowledge synthesis is stale because the "
                    "mission knowledge graph changed after this "
                    "synthesis was created; create a new synthesis "
                    "before validation"
                ),
            )

    # ------------------------------------------------------
    # Same-analysis pre-approve graph-snapshot freshness guard
    #
    # 현재 Synthesis가 만들어진 뒤 같은 Analysis의 다른 Candidate가
    # 먼저 승인되어 Knowledge Graph를 변경했다면 이 Synthesis의
    # existing_knowledge/target 판단은 이미 오래된 snapshot이다.
    #
    # 특히 기존 Graph가 비어 있을 때 생성된 targetless MERGE가
    # 첫 Candidate 승인 후에도 PENDING으로 남아 있던 경우를 여기서
    # 확실히 차단한다.
    # ------------------------------------------------------
    if request.decision == "APPROVE":
        newer_applied_sibling = (
            _find_newer_applied_sibling_synthesis(
                db=db,
                candidate=candidate,
                synthesis=synthesis,
            )
        )

        if newer_applied_sibling is not None:
            _mark_synthesis_stale_for_graph_change(
                synthesis=synthesis,
                candidate=candidate,
                applied_synthesis_id=(
                    newer_applied_sibling.synthesis_id
                ),
                validated_by=request.validated_by,
                now=now,
            )

            db.commit()
            db.refresh(synthesis)
            db.refresh(candidate)

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Knowledge synthesis is stale because another "
                    "candidate from the same interview analysis was "
                    "approved after this synthesis was created; "
                    "create a new synthesis before validation"
                ),
            )

    # ------------------------------------------------------
    # Review Edit stale-synthesis guard
    #
    # Synthesis 생성 시 request_payload에 저장된 Candidate
    # snapshot과 현재 Candidate가 다르면, 수정 전 Synthesis다.
    # status 값과 무관하게 APPROVE를 차단하여 stale synthesis가
    # 실수로 적용되는 것을 이중으로 방지한다.
    # ------------------------------------------------------
    if request.decision == "APPROVE":
        mismatch_fields = _candidate_snapshot_mismatch_fields(
            synthesis=synthesis,
            candidate=candidate,
        )

        if mismatch_fields:
            synthesis.status = "STALE"
            synthesis.validated_by = (
                request.validated_by
                or "K-DNA REVIEW EDIT GUARD"
            )
            synthesis.validation_reason = (
                "Candidate changed after synthesis creation; "
                "re-synthesis is required. mismatched_fields="
                + ",".join(mismatch_fields)
            )
            synthesis.validated_at = now

            if candidate.review_status == "REVIEW_REQUIRED":
                candidate.review_synthesis_id = None

            db.commit()
            db.refresh(synthesis)
            db.refresh(candidate)

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Knowledge synthesis is stale because the "
                    "candidate changed after synthesis creation; "
                    "create a new synthesis before validation"
                ),
            )

    # ------------------------------------------------------
    # REJECT
    #
    # Candidate 자체 상태는 변경하지 않는다.
    #
    # Auto Guardrail이 Synthesis만 REJECT한 뒤
    # 안전한 Context로 재-Synthesis할 수 있기 때문이다.
    # ------------------------------------------------------
    if request.decision == "REJECT":

        synthesis.status = "REJECTED"

        synthesis.validated_by = (
            request.validated_by
        )

        synthesis.validation_reason = (
            request.reason
        )

        synthesis.validated_at = now

        # REVIEW_REQUIRED Candidate를 사람이 Reject한 경우
        # Review Queue에서 종료 상태로 이동시킨다.
        #
        # Auto retry용 Reject는 review_status가 아직
        # REVIEW_REQUIRED가 아니므로 이 분기에 영향을 받지 않는다.
        if candidate.review_status == "REVIEW_REQUIRED":
            candidate.review_status = "REJECTED"
            candidate.review_synthesis_id = synthesis.synthesis_id

            if request.reason:
                candidate.review_reason = request.reason

        db.commit()
        db.refresh(synthesis)
        db.refresh(candidate)

        return KnowledgeSynthesisValidationResponse(
            synthesis_id=(
                synthesis.synthesis_id
            ),
            decision="REJECT",
            status="REJECTED",
            operation=(
                synthesis.operation
            ),
            resulting_knowledge_ids=[],
            knowledge_units=[],
            reason=request.reason,
            validated_by=(
                request.validated_by
            ),
        )

    # ------------------------------------------------------
    # APPROVE + APPLY
    # ------------------------------------------------------
    proposals = (
        db.query(KnowledgeSynthesisUnit)
        .filter(
            KnowledgeSynthesisUnit.synthesis_id
            == synthesis_id
        )
        .order_by(
            KnowledgeSynthesisUnit
            .synthesized_index
            .asc()
        )
        .all()
    )

    if not proposals:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Synthesis has no synthesized "
                "knowledge units"
            ),
        )

    targets = _get_targets(
        db=db,
        synthesis=synthesis,
    )

    # ------------------------------------------------------
    # Target-version stale guard
    #
    # Review Queue에 여러 Candidate가 같은 active Knowledge를 target으로
    # 기다릴 수 있다. 그중 하나가 먼저 승인되어 target이 SUPERSEDED되면
    # 나머지 Synthesis는 생성 시점의 Knowledge snapshot에 기반한 것이므로
    # 재-Synthesis 없이 그대로 적용해서는 안 된다.
    # ------------------------------------------------------
    inactive_target_ids = [
        target.knowledge_id
        for target in targets
        if target.status in {
            "SUPERSEDED",
            "RETIRED",
        }
    ]

    if (
        request.decision == "APPROVE"
        and inactive_target_ids
    ):
        _mark_synthesis_stale_for_target_change(
            db=db,
            synthesis=synthesis,
            candidate=candidate,
            target_ids=inactive_target_ids,
            validated_by=request.validated_by,
            now=now,
        )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Knowledge synthesis is stale because its target "
                "knowledge is no longer active; create a new "
                "synthesis before validation"
            ),
        )

    # ------------------------------------------------------
    # Synthesis structure guard
    # ------------------------------------------------------
    if (
        request.decision == "APPROVE"
        and synthesis.operation in {
            "ENRICH",
            "SUPERSEDE",
        }
        and (
            len(targets) != 1
            or len(proposals) != 1
        )
    ):
        reason = (
            f"{synthesis.operation} requires exactly one target "
            "knowledge and one synthesized unit"
        )
        _mark_synthesis_stale_for_policy_violation(
            db=db,
            synthesis=synthesis,
            candidate=candidate,
            reason=reason,
            validated_by=request.validated_by,
            now=now,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                reason
                + "; create a new synthesis before validation"
            ),
        )

    if (
        request.decision == "APPROVE"
        and synthesis.operation == "ADD_EXCEPTION"
        and (
            len(targets) != 1
            or len(proposals) != 1
        )
    ):
        reason = (
            "ADD_EXCEPTION requires exactly one parent target and "
            "one synthesized exception unit"
        )
        _mark_synthesis_stale_for_policy_violation(
            db=db,
            synthesis=synthesis,
            candidate=candidate,
            reason=reason,
            validated_by=request.validated_by,
            now=now,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                reason
                + "; create a new synthesis before validation"
            ),
        )

    # ------------------------------------------------------
    # Atomic version-chain policy guard
    #
    # ENRICH/SUPERSEDE는 Candidate / target / proposal type이 모두
    # 동일할 때만 같은 root의 새 Version으로 적용한다.
    # ------------------------------------------------------
    if (
        request.decision == "APPROVE"
        and synthesis.operation in {
            "ENRICH",
            "SUPERSEDE",
        }
        and len(targets) == 1
        and len(proposals) == 1
    ):
        version_target = targets[0]
        version_proposal = proposals[0]

        same_type_chain = (
            candidate.knowledge_type
            == version_target.knowledge_type
            == version_proposal.knowledge_type
        )

        if not same_type_chain:
            reason = (
                "Cross-type knowledge version update is not allowed: "
                f"candidate={candidate.knowledge_type}, "
                f"target={version_target.knowledge_type}, "
                f"proposal={version_proposal.knowledge_type}"
            )
            _mark_synthesis_stale_for_policy_violation(
                db=db,
                synthesis=synthesis,
                candidate=candidate,
                reason=reason,
                validated_by=request.validated_by,
                now=now,
            )

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    reason
                    + "; create a new synthesis before validation"
                ),
            )

    # MERGE는 독립 신규 Knowledge 생성에만 사용한다. 기존 target을
    # SUPERSEDE하는 multi-root MERGE는 현재 KnowledgeUnit version model과
    # 일치하지 않으므로 적용하지 않는다.
    if (
        request.decision == "APPROVE"
        and synthesis.operation == "MERGE"
        and (targets or len(proposals) != 1)
    ):
        reason = (
            "MERGE must create exactly one independent Knowledge Unit "
            "and must not have version targets"
        )
        _mark_synthesis_stale_for_policy_violation(
            db=db,
            synthesis=synthesis,
            candidate=candidate,
            reason=reason,
            validated_by=request.validated_by,
            now=now,
        )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                reason
                + "; create a new synthesis before validation"
            ),
        )

    try:
        synthesis.status = "APPROVED"

        synthesis.validated_by = (
            request.validated_by
        )

        synthesis.validation_reason = (
            request.reason
        )

        synthesis.validated_at = now

        applied_map: dict[
            int,
            KnowledgeUnit,
        ] = {}

        # --------------------------------------------------
        # ENRICH / SUPERSEDE
        # --------------------------------------------------
        if synthesis.operation in {
            "ENRICH",
            "SUPERSEDE",
        }:

            if (
                len(targets) != 1
                or len(proposals) != 1
            ):
                raise HTTPException(
                    status_code=(
                        status.HTTP_409_CONFLICT
                    ),
                    detail=(
                        f"{synthesis.operation} "
                        "requires exactly one "
                        "target knowledge and one "
                        "synthesized unit"
                    ),
                )

            target = targets[0]
            proposal = proposals[0]

            # --------------------------------------------------
            # Cross-graph Duplicate / No-op Guard
            #
            # AI가 Candidate와 같은 type의 target을 골라 ENRICH/SUPERSEDE를
            # 제안하더라도, Candidate 자체가 Mission의 다른 활성 Knowledge와
            # 이미 같은 의미일 수 있다.
            #
            # 대표 예:
            #   existing EXCEPTION  : 장애 중 긴급 직접 읽기 조회 예외
            #   existing DECISION_RULE: 장애 종료 후 권한 회수
            #   candidate           : 위 EXCEPTION의 type-drift DECISION_RULE
            #
            # 이때 AI가 DECISION_RULE target을 ENRICH해 두 atomic knowledge를
            # 한 version으로 흡수하면 granularity가 다시 깨진다. 실제 version
            # 생성 전에 Candidate를 현재 Mission의 전체 활성 Knowledge와 다시
            # 비교하고, 이미 존재하는 의미라면 그 Knowledge를 재사용한다.
            # --------------------------------------------------
            duplicate_match = (
                find_duplicate_active_knowledge(
                    db=db,
                    mission_id=synthesis.mission_id,
                    candidate=candidate,
                    embedding_cache=(
                        material_change_embedding_cache
                    ),
                )
            )

            if duplicate_match is not None:
                existing_knowledge = (
                    duplicate_match.knowledge
                )

                proposal.validation_status = "VERIFIED"
                proposal.applied_knowledge_id = (
                    existing_knowledge.knowledge_id
                )

                _create_evidence(
                    db=db,
                    knowledge=existing_knowledge,
                    synthesis=synthesis,
                    candidate=candidate,
                    analysis=analysis,
                )

                candidate.validation_status = "VERIFIED"

                if (
                    candidate.review_status
                    == "REVIEW_REQUIRED"
                ):
                    candidate.review_status = "RESOLVED"
                    candidate.review_synthesis_id = (
                        synthesis.synthesis_id
                    )

                    if request.reason:
                        candidate.review_reason = (
                            request.reason
                        )

                synthesis.status = "APPLIED"
                synthesis.applied_at = now
                synthesis.resulting_knowledge_ids = [
                    str(existing_knowledge.knowledge_id)
                ]

                base_reason = (
                    request.reason.strip()
                    if request.reason
                    and request.reason.strip()
                    else "Synthesis approved"
                )
                synthesis.validation_reason = (
                    f"{base_reason}; candidate duplicate/no-op, "
                    f"existing active knowledge reused; "
                    f"match_type={duplicate_match.match_type}"
                )

                db.commit()
                db.refresh(synthesis)
                db.refresh(candidate)
                db.refresh(proposal)

                logger.info(
                    (
                        "Knowledge version absorption suppressed "
                        "synthesis_id=%s candidate_id=%s "
                        "proposed_target_id=%s "
                        "reused_knowledge_id=%s match_type=%s"
                    ),
                    synthesis.synthesis_id,
                    candidate.candidate_id,
                    target.knowledge_id,
                    existing_knowledge.knowledge_id,
                    duplicate_match.match_type,
                )

                return (
                    KnowledgeSynthesisValidationResponse(
                        synthesis_id=(
                            synthesis.synthesis_id
                        ),
                        decision="APPROVE",
                        status="APPLIED",
                        operation=(
                            synthesis.operation
                        ),
                        resulting_knowledge_ids=[
                            existing_knowledge.knowledge_id
                        ],
                        knowledge_units=[
                            AppliedKnowledgeUnit(
                                synthesis_unit_id=(
                                    proposal
                                    .synthesis_unit_id
                                ),
                                knowledge_id=(
                                    existing_knowledge
                                    .knowledge_id
                                ),
                                knowledge_type=(
                                    existing_knowledge
                                    .knowledge_type
                                ),
                                statement=(
                                    existing_knowledge
                                    .statement
                                ),
                                version=(
                                    existing_knowledge
                                    .version
                                ),
                                status=(
                                    existing_knowledge
                                    .status
                                ),
                            )
                        ],
                        reason=request.reason,
                        validated_by=(
                            request.validated_by
                        ),
                    )
                )

            root_id = (
                target.root_knowledge_id
                if target.root_knowledge_id
                is not None
                else target.knowledge_id
            )

            # --------------------------------------------------
            # Post-synthesis Material Change Guard
            #
            # Candidate-level duplicate suppression을 통과했더라도
            # AI Synthesis 결과가 target Knowledge의 단순 재서술일
            # 수 있다. 이 경우 새 version을 만들지 않고 기존
            # Knowledge를 그대로 재사용하며 Evidence만 누적한다.
            # --------------------------------------------------
            material_assessment = (
                assess_synthesized_unit_material_change(
                    target=target,
                    proposal=proposal,
                    embedding_cache=(
                        material_change_embedding_cache
                    ),
                )
            )

            if not material_assessment.material_change:
                proposal.validation_status = "VERIFIED"
                proposal.applied_knowledge_id = (
                    target.knowledge_id
                )

                _create_evidence(
                    db=db,
                    knowledge=target,
                    synthesis=synthesis,
                    candidate=candidate,
                    analysis=analysis,
                )

                candidate.validation_status = "VERIFIED"

                if (
                    candidate.review_status
                    == "REVIEW_REQUIRED"
                ):
                    candidate.review_status = "RESOLVED"
                    candidate.review_synthesis_id = (
                        synthesis.synthesis_id
                    )

                    if request.reason:
                        candidate.review_reason = (
                            request.reason
                        )

                synthesis.status = "APPLIED"
                synthesis.applied_at = now
                synthesis.resulting_knowledge_ids = [
                    str(target.knowledge_id)
                ]

                base_reason = (
                    request.reason.strip()
                    if request.reason
                    and request.reason.strip()
                    else "Synthesis approved"
                )
                synthesis.validation_reason = (
                    f"{base_reason}; no material knowledge "
                    f"change, existing target reused; "
                    f"{material_assessment.reason}"
                )

                db.commit()
                db.refresh(synthesis)
                db.refresh(candidate)
                db.refresh(proposal)

                logger.info(
                    (
                        "Knowledge version inflation suppressed "
                        "synthesis_id=%s candidate_id=%s "
                        "target_knowledge_id=%s reason=%s"
                    ),
                    synthesis.synthesis_id,
                    candidate.candidate_id,
                    target.knowledge_id,
                    material_assessment.reason,
                )

                return (
                    KnowledgeSynthesisValidationResponse(
                        synthesis_id=(
                            synthesis.synthesis_id
                        ),
                        decision="APPROVE",
                        status="APPLIED",
                        operation=(
                            synthesis.operation
                        ),
                        resulting_knowledge_ids=[
                            target.knowledge_id
                        ],
                        knowledge_units=[
                            AppliedKnowledgeUnit(
                                synthesis_unit_id=(
                                    proposal
                                    .synthesis_unit_id
                                ),
                                knowledge_id=(
                                    target.knowledge_id
                                ),
                                knowledge_type=(
                                    target.knowledge_type
                                ),
                                statement=(
                                    target.statement
                                ),
                                version=(
                                    target.version
                                ),
                                status=(
                                    target.status
                                ),
                            )
                        ],
                        reason=request.reason,
                        validated_by=(
                            request.validated_by
                        ),
                    )
                )

            new_knowledge = (
                _create_new_unit(
                    db=db,
                    synthesis=synthesis,
                    proposal=proposal,
                    source_candidate_id=(
                        candidate.candidate_id
                    ),
                    version=(
                        target.version + 1
                    ),
                    root_knowledge_id=(
                        root_id
                    ),
                    supersedes_id=(
                        target.knowledge_id
                    ),
                )
            )

            target.status = "SUPERSEDED"

            _add_relation_if_missing(
                db=db,
                mission_id=(
                    synthesis.mission_id
                ),
                source_id=(
                    new_knowledge.knowledge_id
                ),
                target_id=(
                    target.knowledge_id
                ),
                relation_type="SUPERSEDES",
                source_analysis_id=(
                    analysis.analysis_id
                    if analysis is not None
                    else None
                ),
            )

            # 이전 Version에 연결된 지속 의미 관계를 새 Version에도
            # 승계한다. 현재는 HAS_EXCEPTION만 대상이다.
            _inherit_persistent_relations_for_new_version(
                db=db,
                target=target,
                new_knowledge=new_knowledge,
            )

            applied_map[
                proposal.synthesized_index
            ] = new_knowledge

        # --------------------------------------------------
        # MERGE
        #
        # MERGE는 기존 Knowledge를 대체하지 않는다. 독립 신규
        # atomic Knowledge Unit 1개를 생성하는 operation으로 제한한다.
        # 기존 Knowledge와의 의미 관계는 아래 AI Relation 단계에서만
        # SUPPORTS/REFINES/HAS_EXCEPTION 등으로 표현한다.
        # --------------------------------------------------
        elif synthesis.operation == "MERGE":

            proposal = proposals[0]

            # --------------------------------------------------
            # Post-freshness Duplicate / No-op Guard
            #
            # Candidate가 처음 만들어졌을 때는 Mission Graph가 비어
            # 있었더라도, Human Review 대기 중 다른 Candidate가 먼저
            # 승인되면 동일 의미의 VERIFIED Knowledge가 생길 수 있다.
            #
            # Freshness guard로 기존 Synthesis를 STALE 처리한 뒤
            # 수동 re-Synthesis하면 operation이 독립 MERGE로 다시
            # 생성될 수 있으므로, 실제 새 Knowledge Unit을 만들기
            # 직전에 현재 활성 Graph 기준 duplicate를 한 번 더
            # 확인한다.
            #
            # Duplicate라면 새 Unit/version을 만들지 않고 기존
            # Knowledge를 재사용하고 이번 Interview Message만
            # Evidence로 누적한다. 이 경로는 Graph를 변경하지 않으므로
            # 다른 대기 Synthesis를 다시 STALE 처리하지 않는다.
            # --------------------------------------------------
            duplicate_match = (
                find_duplicate_active_knowledge(
                    db=db,
                    mission_id=synthesis.mission_id,
                    candidate=candidate,
                    embedding_cache=(
                        material_change_embedding_cache
                    ),
                )
            )

            if duplicate_match is not None:
                existing_knowledge = (
                    duplicate_match.knowledge
                )

                proposal.validation_status = "VERIFIED"
                proposal.applied_knowledge_id = (
                    existing_knowledge.knowledge_id
                )

                _create_evidence(
                    db=db,
                    knowledge=existing_knowledge,
                    synthesis=synthesis,
                    candidate=candidate,
                    analysis=analysis,
                )

                candidate.validation_status = "VERIFIED"

                if (
                    candidate.review_status
                    == "REVIEW_REQUIRED"
                ):
                    candidate.review_status = "RESOLVED"
                    candidate.review_synthesis_id = (
                        synthesis.synthesis_id
                    )

                    if request.reason:
                        candidate.review_reason = (
                            request.reason
                        )

                synthesis.status = "APPLIED"
                synthesis.applied_at = now
                synthesis.resulting_knowledge_ids = [
                    str(existing_knowledge.knowledge_id)
                ]

                base_reason = (
                    request.reason.strip()
                    if request.reason
                    and request.reason.strip()
                    else "Synthesis approved"
                )
                synthesis.validation_reason = (
                    f"{base_reason}; duplicate/no-op candidate, "
                    "existing active knowledge reused; "
                    f"match_type={duplicate_match.match_type}, "
                    f"combined_score="
                    f"{duplicate_match.combined_score:.4f}"
                )

                db.commit()
                db.refresh(synthesis)
                db.refresh(candidate)
                db.refresh(proposal)

                logger.info(
                    (
                        "Independent MERGE duplicate suppressed "
                        "synthesis_id=%s candidate_id=%s "
                        "knowledge_id=%s match_type=%s "
                        "combined_score=%.4f"
                    ),
                    synthesis.synthesis_id,
                    candidate.candidate_id,
                    existing_knowledge.knowledge_id,
                    duplicate_match.match_type,
                    duplicate_match.combined_score,
                )

                return (
                    KnowledgeSynthesisValidationResponse(
                        synthesis_id=(
                            synthesis.synthesis_id
                        ),
                        decision="APPROVE",
                        status="APPLIED",
                        operation=(
                            synthesis.operation
                        ),
                        resulting_knowledge_ids=[
                            existing_knowledge.knowledge_id
                        ],
                        knowledge_units=[
                            AppliedKnowledgeUnit(
                                synthesis_unit_id=(
                                    proposal
                                    .synthesis_unit_id
                                ),
                                knowledge_id=(
                                    existing_knowledge
                                    .knowledge_id
                                ),
                                knowledge_type=(
                                    existing_knowledge
                                    .knowledge_type
                                ),
                                statement=(
                                    existing_knowledge.statement
                                ),
                                version=(
                                    existing_knowledge.version
                                ),
                                status=(
                                    existing_knowledge.status
                                ),
                            )
                        ],
                        reason=request.reason,
                        validated_by=(
                            request.validated_by
                        ),
                    )
                )

            knowledge = _create_new_unit(
                db=db,
                synthesis=synthesis,
                proposal=proposal,
                source_candidate_id=(
                    candidate.candidate_id
                ),
            )

            applied_map[
                proposal.synthesized_index
            ] = knowledge

        # --------------------------------------------------
        # ADD_EXCEPTION
        # SPLIT_BY_CONTEXT
        # KEEP_CONFLICT
        #
        # Manual Apply API에서는 기존 동작 유지.
        #
        # Auto Pipeline에서의 허용/차단 여부는
        # auto_knowledge_sync_service의 Guardrail이
        # 결정한다.
        # --------------------------------------------------
        else:

            for proposal in proposals:

                knowledge = _create_new_unit(
                    db=db,
                    synthesis=synthesis,
                    proposal=proposal,
                    source_candidate_id=(
                        candidate.candidate_id
                    ),
                )

                applied_map[
                    proposal.synthesized_index
                ] = knowledge

        # --------------------------------------------------
        # AI 제안 Relation 적용
        # --------------------------------------------------
        proposed_relations = (
            db.query(
                KnowledgeSynthesisRelation
            )
            .filter(
                KnowledgeSynthesisRelation
                .synthesis_id
                == synthesis_id
            )
            .all()
        )

        for proposal_relation in (
            proposed_relations
        ):

            synthesized = applied_map.get(
                proposal_relation
                .synthesized_index
            )

            if synthesized is None:
                raise HTTPException(
                    status_code=(
                        status.HTTP_409_CONFLICT
                    ),
                    detail=(
                        "Synthesis relation "
                        "references a missing "
                        "synthesized unit"
                    ),
                )

            target_id = (
                proposal_relation
                .target_knowledge_id
            )

            # HAS_EXCEPTION 방향:
            #
            # PRINCIPLE
            #     |
            #     +-- HAS_EXCEPTION --> EXCEPTION
            if (
                proposal_relation.relation_type
                == "HAS_EXCEPTION"
            ):

                source_id = target_id

                relation_target_id = (
                    synthesized.knowledge_id
                )

            else:

                source_id = (
                    synthesized.knowledge_id
                )

                relation_target_id = (
                    target_id
                )

            relation_type = (
                proposal_relation.relation_type
            )

            # 같은 Version pair에는 SUPERSEDES만 남긴다. AI가
            # SUPPORTS/REFINES/SUPERSEDES를 함께 제안해도 predecessor와의
            # 중복 의미 edge를 추가하지 않는다.
            if (
                synthesis.operation in {
                    "ENRICH",
                    "SUPERSEDE",
                }
                and len(targets) == 1
                and target_id == targets[0].knowledge_id
                and relation_type in {
                    "SUPPORTS",
                    "REFINES",
                    "SUPERSEDES",
                }
            ):
                continue

            # MERGE는 version replacement가 아니므로 legacy/AI가 남긴
            # SUPERSEDES relation은 semantic REFINES로 낮춘다.
            if (
                synthesis.operation == "MERGE"
                and relation_type == "SUPERSEDES"
            ):
                relation_type = "REFINES"

            _add_relation_if_missing(
                db=db,
                mission_id=(
                    synthesis.mission_id
                ),
                source_id=source_id,
                target_id=(
                    relation_target_id
                ),
                relation_type=relation_type,
                source_analysis_id=(
                    analysis.analysis_id
                    if analysis is not None
                    else None
                ),
            )

        # --------------------------------------------------
        # Evidence
        # --------------------------------------------------
        for knowledge in (
            applied_map.values()
        ):

            _create_evidence(
                db=db,
                knowledge=knowledge,
                synthesis=synthesis,
                candidate=candidate,
                analysis=analysis,
            )

        resulting_ids = [
            knowledge.knowledge_id
            for knowledge
            in applied_map.values()
        ]

        # --------------------------------------------------
        # Candidate 승격 상태 동기화
        #
        # 실제 Knowledge Unit까지 적용된 Candidate는
        # 더 이상 CANDIDATE 상태로 남기지 않는다.
        # --------------------------------------------------
        candidate.validation_status = (
            "VERIFIED"
        )

        # 사람이 Review Queue에서 승인한 Candidate라면
        # Review 상태도 함께 종료한다.
        if candidate.review_status == "REVIEW_REQUIRED":
            candidate.review_status = "RESOLVED"
            candidate.review_synthesis_id = synthesis.synthesis_id

            if request.reason:
                candidate.review_reason = request.reason

        # --------------------------------------------------
        # Synthesis 완료
        # --------------------------------------------------
        synthesis.status = "APPLIED"

        synthesis.applied_at = now

        synthesis.resulting_knowledge_ids = [
            str(value)
            for value in resulting_ids
        ]

        # --------------------------------------------------
        # Same-analysis graph-snapshot stale guard
        #
        # 이 APPROVE가 새 Knowledge Unit/Version을 실제 생성한 경우
        # 같은 analysis에서 먼저 생성되어 대기 중이던 다른 Synthesis는
        # 현재 Graph를 반영하지 못한 snapshot이다.
        #
        # target이 있었던 ENRICH뿐 아니라, Graph가 비어 있을 때 만들어진
        # targetless MERGE도 포함하여 모두 STALE 처리한다.
        # 다음 Review에서는 반드시 재-Synthesis하여 최신 VERIFIED
        # Knowledge와 Relation을 다시 판단하게 한다.
        #
        # No-op reuse는 위에서 early return하므로 이 경로에 도달하지 않는다.
        # --------------------------------------------------
        if (
            analysis is not None
            and resulting_ids
        ):
            _mark_waiting_syntheses_stale_after_graph_change(
                db=db,
                analysis_id=analysis.analysis_id,
                applied_candidate_id=candidate.candidate_id,
                applied_synthesis_id=synthesis.synthesis_id,
                validated_by=request.validated_by,
                now=now,
            )

            # Analysis가 다른 Review Candidate도 동일 Mission Graph의
            # 오래된 snapshot을 들고 있을 수 있으므로 함께 STALE 처리한다.
            _mark_waiting_mission_syntheses_stale_after_graph_change(
                db=db,
                mission_id=synthesis.mission_id,
                applied_candidate_id=candidate.candidate_id,
                applied_synthesis_id=synthesis.synthesis_id,
                validated_by=request.validated_by,
                now=now,
            )

        db.commit()
        db.refresh(synthesis)
        db.refresh(candidate)

        knowledge_units = [
            AppliedKnowledgeUnit(
                synthesis_unit_id=(
                    proposal.synthesis_unit_id
                ),
                knowledge_id=(
                    applied_map[
                        proposal.synthesized_index
                    ].knowledge_id
                ),
                knowledge_type=(
                    applied_map[
                        proposal.synthesized_index
                    ].knowledge_type
                ),
                statement=(
                    applied_map[
                        proposal.synthesized_index
                    ].statement
                ),
                version=(
                    applied_map[
                        proposal.synthesized_index
                    ].version
                ),
                status=(
                    applied_map[
                        proposal.synthesized_index
                    ].status
                ),
            )
            for proposal in proposals
        ]

        return KnowledgeSynthesisValidationResponse(
            synthesis_id=(
                synthesis.synthesis_id
            ),
            decision="APPROVE",
            status="APPLIED",
            operation=(
                synthesis.operation
            ),
            resulting_knowledge_ids=(
                resulting_ids
            ),
            knowledge_units=(
                knowledge_units
            ),
            reason=request.reason,
            validated_by=(
                request.validated_by
            ),
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Knowledge synthesis apply "
                f"failed: {str(exc)}"
            ),
        )