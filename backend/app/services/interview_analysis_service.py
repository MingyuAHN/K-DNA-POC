import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.interview_analysis import (
    ConflictSource,
    InterviewAnalysis,
    KnowledgeCandidate,
    KnowledgeConflict,
    KnowledgeGap,
    QuestionCandidate,
)
from app.schemas.interview_orchestration import (
    InterviewOrchestrationResponse,
)
from app.services.conflict_normalization_service import (
    resolve_conflict_source_type,
)


def save_interview_analysis(
    db: Session,
    mission_id: uuid.UUID,
    interview_id: uuid.UUID,
    source_message_id: uuid.UUID,
    assistant_message_id: uuid.UUID | None,
    request_context: dict[str, Any],
    result: InterviewOrchestrationResponse,
) -> InterviewAnalysis:

    try:
        existing = (
            db.query(InterviewAnalysis)
            .filter(
                InterviewAnalysis.source_message_id
                == source_message_id
            )
            .first()
        )

        if existing is not None:
            db.delete(existing)
            db.flush()

        # -------------------------------------------------
        # raw_response는 AI가 실제 반환한 원본을
        # 그대로 보존한다.
        #
        # 따라서 AI가 source_type="Knowledge"를
        # 반환했다면 raw_response에는 그대로 남는다.
        #
        # 정규화된 provenance는 아래 ConflictSource
        # 저장 단계에서 적용한다.
        # -------------------------------------------------
        analysis = InterviewAnalysis(
            mission_id=mission_id,
            interview_id=interview_id,
            source_message_id=source_message_id,
            assistant_message_id=assistant_message_id,
            request_context=request_context,
            raw_response=result.model_dump(
                mode="json"
            ),
        )

        db.add(analysis)
        db.flush()

        for item in result.knowledge_candidates:

            db.add(
                KnowledgeCandidate(
                    analysis_id=analysis.analysis_id,
                    statement=item.statement,
                    knowledge_type=item.type,
                    context=item.context.model_dump(
                        mode="json"
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
            )

        for item in result.gaps:

            db.add(
                KnowledgeGap(
                    analysis_id=analysis.analysis_id,
                    topic=item.topic,
                    dimension=item.dimension,
                    gap_type=item.gap_type,
                    gap_score=item.gap_score,
                    reason=item.reason,
                )
            )

        for item in result.conflicts:

            conflict = KnowledgeConflict(
                analysis_id=analysis.analysis_id,
                conflict_type=item.conflict_type,
                severity=item.severity,
                description=item.description,
                context_difference=(
                    item.context_difference
                ),
                unknown_condition=(
                    item.unknown_condition
                ),
                recommended_question=(
                    item.recommended_question
                ),
            )

            db.add(conflict)
            db.flush()

            for source in item.sources:

                normalized_source_type = (
                    resolve_conflict_source_type(
                        source_type=(
                            source.source_type
                        ),
                        source_id=(
                            source.source_id
                        ),
                        request_context=(
                            request_context
                        ),
                    )
                )

                db.add(
                    ConflictSource(
                        conflict_id=(
                            conflict.conflict_id
                        ),
                        source_type=(
                            normalized_source_type
                        ),
                        source_id=source.source_id,
                        content=source.content,
                    )
                )

        for item in result.question_candidates:

            is_selected = False

            if result.next_question is not None:
                is_selected = (
                    item.question
                    == result.next_question.question
                    and item.question_type
                    == result.next_question.question_type
                )

            db.add(
                QuestionCandidate(
                    analysis_id=analysis.analysis_id,
                    assistant_message_id=(
                        assistant_message_id
                        if is_selected
                        else None
                    ),
                    question=item.question,
                    question_type=item.question_type,
                    target_gap=item.target_gap,
                    gap_reduction_score=(
                        item.gap_reduction_score
                    ),
                    novelty_score=(
                        item.novelty_score
                    ),
                    business_impact_score=(
                        item.business_impact_score
                    ),
                    conflict_resolution_score=(
                        item.conflict_resolution_score
                    ),
                    redundancy_score=(
                        item.redundancy_score
                    ),
                    value_score=item.value_score,
                    is_selected=is_selected,
                )
            )

        db.commit()
        db.refresh(analysis)

        return analysis

    except HTTPException:
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Interview analysis save failed: "
                f"{str(exc)}"
            ),
        )