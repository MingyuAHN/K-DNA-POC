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


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


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
            confidence_score=1.0,
            source_analysis_id=(
                source_analysis_id
            ),
        )
    )


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
    # REJECT
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

        db.commit()
        db.refresh(synthesis)

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
        #
        # 기존 Knowledge의 새 Version으로 생성
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

            if target.status in {
                "SUPERSEDED",
                "RETIRED",
            }:
                raise HTTPException(
                    status_code=(
                        status.HTTP_409_CONFLICT
                    ),
                    detail=(
                        "Target knowledge is "
                        "not an active version"
                    ),
                )

            root_id = (
                target.root_knowledge_id
                if target.root_knowledge_id
                is not None
                else target.knowledge_id
            )

            new_knowledge = (
                _create_new_unit(
                    db=db,
                    synthesis=synthesis,
                    proposal=proposal,
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

            applied_map[
                proposal.synthesized_index
            ] = new_knowledge

        # --------------------------------------------------
        # MERGE
        #
        # 새 Knowledge를 만들고 기존 Target들을 대체
        # --------------------------------------------------
        elif synthesis.operation == "MERGE":

            for proposal in proposals:

                knowledge = _create_new_unit(
                    db=db,
                    synthesis=synthesis,
                    proposal=proposal,
                )

                applied_map[
                    proposal.synthesized_index
                ] = knowledge

            for target in targets:

                if target.status not in {
                    "SUPERSEDED",
                    "RETIRED",
                }:
                    target.status = "SUPERSEDED"

                for knowledge in (
                    applied_map.values()
                ):

                    _add_relation_if_missing(
                        db=db,
                        mission_id=(
                            synthesis.mission_id
                        ),
                        source_id=(
                            knowledge.knowledge_id
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

        # --------------------------------------------------
        # ADD_EXCEPTION
        # SPLIT_BY_CONTEXT
        # KEEP_CONFLICT
        #
        # 기존 Knowledge를 유지하고 새 Knowledge 생성
        # --------------------------------------------------
        else:

            for proposal in proposals:

                knowledge = _create_new_unit(
                    db=db,
                    synthesis=synthesis,
                    proposal=proposal,
                )

                applied_map[
                    proposal.synthesized_index
                ] = knowledge

        # --------------------------------------------------
        # AI가 제안한 Relations 적용
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

            _add_relation_if_missing(
                db=db,
                mission_id=(
                    synthesis.mission_id
                ),
                source_id=source_id,
                target_id=(
                    relation_target_id
                ),
                relation_type=(
                    proposal_relation
                    .relation_type
                ),
                source_analysis_id=(
                    analysis.analysis_id
                    if analysis is not None
                    else None
                ),
            )

        # --------------------------------------------------
        # Evidence 연결
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
        # Synthesis 완료 처리
        # --------------------------------------------------
        synthesis.status = "APPLIED"

        synthesis.applied_at = now

        synthesis.resulting_knowledge_ids = [
            str(value)
            for value in resulting_ids
        ]

        db.commit()
        db.refresh(synthesis)

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