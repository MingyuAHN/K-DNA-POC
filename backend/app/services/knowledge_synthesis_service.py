import uuid

from fastapi import (
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.clients.ai_client import (
    AIClientError,
    ai_client,
)
from app.models.interview_analysis import (
    InterviewAnalysis,
    KnowledgeCandidate,
)
from app.models.knowledge_core import (
    KnowledgeUnit,
)
from app.models.knowledge_synthesis import (
    KnowledgeSynthesis,
    KnowledgeSynthesisRelation,
    KnowledgeSynthesisUnit,
)
from app.schemas.knowledge_synthesis import (
    ExistingKnowledge,
    KnowledgeSynthesisAIRequest,
    KnowledgeSynthesisRequest,
    KnowledgeSynthesisResponse,
    StoredSynthesizedKnowledgeUnit,
    StoredSynthesisRelation,
    SynthesisCandidate,
    SynthesisContext,
    SynthesisDecisionRule,
)


ACTIVE_KNOWLEDGE_STATUSES = {
    "VERIFIED",
    "EXPERT_OPINION",
}


def _float_or_none(
    value,
) -> float | None:
    if value is None:
        return None

    return float(value)


def _candidate_to_ai(
    candidate: KnowledgeCandidate,
) -> SynthesisCandidate:

    context = (
        candidate.context or {}
    )

    decision_rule = None

    if candidate.decision_rule:
        decision_rule = (
            SynthesisDecisionRule
            .model_validate(
                candidate.decision_rule
            )
        )

    return SynthesisCandidate(
        statement=candidate.statement,
        type=candidate.knowledge_type,
        context=(
            SynthesisContext
            .model_validate(context)
        ),
        decision_rule=decision_rule,
        rationale=candidate.rationale,
        exception=candidate.exception,
        novelty_score=(
            float(candidate.novelty_score)
            if candidate.novelty_score
            is not None
            else 0.0
        ),
        confidence_score=(
            float(candidate.confidence_score)
            if candidate.confidence_score
            is not None
            else 0.0
        ),
        validation_status=(
            candidate.validation_status
        ),
    )


def _knowledge_to_ai(
    knowledge: KnowledgeUnit,
) -> ExistingKnowledge:

    return ExistingKnowledge(
        knowledge_id=knowledge.knowledge_id,
        statement=knowledge.statement,
        type=knowledge.knowledge_type,
        context=knowledge.context or {},
        decision_rule=knowledge.decision_rule,
        rationale=knowledge.rationale,
        exception=knowledge.exception,
        confidence_score=(
            _float_or_none(
                knowledge.confidence_score
            )
        ),
        validation_status=knowledge.status,
    )


def _get_related_knowledge(
    db: Session,
    mission_id: uuid.UUID,
    requested_ids: list[uuid.UUID],
) -> list[KnowledgeUnit]:

    # ------------------------------------------------------
    # related_knowledge_ids가 지정된 경우
    # 해당 Knowledge만 사용
    # ------------------------------------------------------
    if requested_ids:
        rows = (
            db.query(KnowledgeUnit)
            .filter(
                KnowledgeUnit.knowledge_id.in_(
                    requested_ids
                )
            )
            .all()
        )

        row_map = {
            row.knowledge_id: row
            for row in rows
        }

        missing = [
            knowledge_id
            for knowledge_id in requested_ids
            if knowledge_id not in row_map
        ]

        if missing:
            raise HTTPException(
                status_code=(
                    status.HTTP_404_NOT_FOUND
                ),
                detail=(
                    "Related knowledge unit "
                    f"not found: {missing[0]}"
                ),
            )

        result = []

        for knowledge_id in requested_ids:
            row = row_map[knowledge_id]

            if row.mission_id != mission_id:
                raise HTTPException(
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    ),
                    detail=(
                        "Related knowledge must "
                        "belong to the same mission"
                    ),
                )

            if (
                row.status
                not in ACTIVE_KNOWLEDGE_STATUSES
            ):
                raise HTTPException(
                    status_code=(
                        status.HTTP_409_CONFLICT
                    ),
                    detail=(
                        "Related knowledge unit "
                        f"{knowledge_id} is not active"
                    ),
                )

            result.append(row)

        return result

    # ------------------------------------------------------
    # 별도 ID가 없으면 PoC 기준으로
    # 같은 Mission의 활성 Knowledge 최대 20건 사용
    #
    # 추후 Knowledge Unit Embedding이 붙으면
    # Semantic Retrieval 방식으로 변경
    # ------------------------------------------------------
    return (
        db.query(KnowledgeUnit)
        .filter(
            KnowledgeUnit.mission_id
            == mission_id,
            KnowledgeUnit.status.in_(
                ACTIVE_KNOWLEDGE_STATUSES
            ),
        )
        .order_by(
            KnowledgeUnit.updated_at.desc()
        )
        .limit(20)
        .all()
    )


def synthesize_candidate(
    db: Session,
    candidate_id: uuid.UUID,
    request: KnowledgeSynthesisRequest,
) -> KnowledgeSynthesisResponse:

    candidate = (
        db.query(KnowledgeCandidate)
        .filter(
            KnowledgeCandidate.candidate_id
            == candidate_id
        )
        .first()
    )

    if candidate is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Knowledge candidate not found"
            ),
        )

    analysis = (
        db.query(InterviewAnalysis)
        .filter(
            InterviewAnalysis.analysis_id
            == candidate.analysis_id
        )
        .first()
    )

    if analysis is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Interview analysis not found"
            ),
        )

    related_knowledge = (
        _get_related_knowledge(
            db=db,
            mission_id=analysis.mission_id,
            requested_ids=(
                request.related_knowledge_ids
            ),
        )
    )

    ai_request = KnowledgeSynthesisAIRequest(
        candidate=_candidate_to_ai(
            candidate
        ),
        existing_knowledge=[
            _knowledge_to_ai(row)
            for row in related_knowledge
        ],
    )

    try:
        ai_result = (
            ai_client.synthesize_knowledge(
                request=ai_request
            )
        )

    except AIClientError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "AI knowledge synthesis "
                f"service error: {str(exc)}"
            ),
        )

    allowed_target_ids = {
        row.knowledge_id
        for row in related_knowledge
    }

    # ------------------------------------------------------
    # AI가 Backend에서 전달하지 않은 Knowledge ID를
    # 임의로 Relation 대상으로 반환하는 것 방지
    # ------------------------------------------------------
    for target_id in (
        ai_result.target_knowledge_ids
    ):
        if target_id not in allowed_target_ids:
            raise HTTPException(
                status_code=(
                    status.HTTP_502_BAD_GATEWAY
                ),
                detail=(
                    "AI synthesis returned an "
                    "unknown target_knowledge_id"
                ),
            )

    unit_count = len(
        ai_result.synthesized_knowledge_units
    )

    for relation in ai_result.relations:

        if (
            relation.synthesized_index
            >= unit_count
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_502_BAD_GATEWAY
                ),
                detail=(
                    "AI synthesis returned an "
                    "invalid synthesized_index"
                ),
            )

        if (
            relation.target_knowledge_id
            not in allowed_target_ids
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_502_BAD_GATEWAY
                ),
                detail=(
                    "AI synthesis relation "
                    "references unknown knowledge"
                ),
            )

    try:
        synthesis = KnowledgeSynthesis(
            mission_id=analysis.mission_id,
            candidate_id=candidate.candidate_id,
            operation=ai_result.operation,
            target_knowledge_ids=[
                str(item)
                for item
                in ai_result.target_knowledge_ids
            ],
            reason=ai_result.reason,
            request_payload=(
                ai_request.model_dump(
                    mode="json"
                )
            ),
            raw_response=(
                ai_result.model_dump(
                    mode="json"
                )
            ),
        )

        db.add(synthesis)
        db.flush()

        stored_units = []

        for index, item in enumerate(
            ai_result
            .synthesized_knowledge_units
        ):
            row = KnowledgeSynthesisUnit(
                synthesis_id=(
                    synthesis.synthesis_id
                ),
                synthesized_index=index,
                statement=item.statement,
                knowledge_type=item.type,
                context=(
                    item.context.model_dump(
                        mode="json"
                    )
                ),
                decision_rule=(
                    item.decision_rule.model_dump(
                        mode="json"
                    )
                    if item.decision_rule
                    is not None
                    else None
                ),
                rationale=item.rationale,
                exception=item.exception,
                novelty_score=(
                    item.novelty_score
                ),
                confidence_score=(
                    item.confidence_score
                ),
                validation_status=(
                    item.validation_status
                ),
            )

            db.add(row)
            db.flush()

            stored_units.append(
                StoredSynthesizedKnowledgeUnit(
                    synthesis_unit_id=(
                        row.synthesis_unit_id
                    ),
                    synthesized_index=index,
                    statement=item.statement,
                    type=item.type,
                    context=item.context,
                    decision_rule=(
                        item.decision_rule
                    ),
                    rationale=item.rationale,
                    exception=item.exception,
                    novelty_score=(
                        item.novelty_score
                    ),
                    confidence_score=(
                        item.confidence_score
                    ),
                    validation_status=(
                        item.validation_status
                    ),
                )
            )

        stored_relations = []

        for item in ai_result.relations:

            row = KnowledgeSynthesisRelation(
                synthesis_id=(
                    synthesis.synthesis_id
                ),
                synthesized_index=(
                    item.synthesized_index
                ),
                target_knowledge_id=(
                    item.target_knowledge_id
                ),
                relation_type=(
                    item.relation
                ),
                reason=item.reason,
            )

            db.add(row)
            db.flush()

            stored_relations.append(
                StoredSynthesisRelation(
                    synthesis_relation_id=(
                        row.synthesis_relation_id
                    ),
                    synthesized_index=(
                        row.synthesized_index
                    ),
                    target_knowledge_id=(
                        row.target_knowledge_id
                    ),
                    relation=row.relation_type,
                    reason=row.reason,
                )
            )

        db.commit()
        db.refresh(synthesis)

        return KnowledgeSynthesisResponse(
            synthesis_id=(
                synthesis.synthesis_id
            ),
            candidate_id=(
                candidate.candidate_id
            ),
            mission_id=(
                analysis.mission_id
            ),
            operation=(
                ai_result.operation
            ),
            target_knowledge_ids=(
                ai_result
                .target_knowledge_ids
            ),
            synthesized_knowledge_units=(
                stored_units
            ),
            relations=stored_relations,
            reason=ai_result.reason,
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
                "Knowledge synthesis save failed: "
                f"{str(exc)}"
            ),
        )