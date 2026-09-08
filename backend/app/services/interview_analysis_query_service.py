import uuid

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
from app.schemas.interview_analysis import (
    InterviewAnalysisDetailResponse,
    StoredConflictSource,
    StoredKnowledgeCandidate,
    StoredKnowledgeConflict,
    StoredKnowledgeGap,
    StoredQuestionCandidate,
)


def decimal_to_float(
    value,
) -> float | None:

    if value is None:
        return None

    return float(value)


def get_interview_analysis_detail(
    db: Session,
    analysis_id: uuid.UUID,
) -> InterviewAnalysisDetailResponse:

    analysis = (
        db.query(InterviewAnalysis)
        .filter(
            InterviewAnalysis.analysis_id
            == analysis_id
        )
        .first()
    )

    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview analysis not found",
        )

    candidate_rows = (
        db.query(KnowledgeCandidate)
        .filter(
            KnowledgeCandidate.analysis_id
            == analysis_id
        )
        .order_by(
            KnowledgeCandidate.created_at.asc()
        )
        .all()
    )

    gap_rows = (
        db.query(KnowledgeGap)
        .filter(
            KnowledgeGap.analysis_id
            == analysis_id
        )
        .order_by(
            KnowledgeGap.created_at.asc()
        )
        .all()
    )

    conflict_rows = (
        db.query(KnowledgeConflict)
        .filter(
            KnowledgeConflict.analysis_id
            == analysis_id
        )
        .order_by(
            KnowledgeConflict.created_at.asc()
        )
        .all()
    )

    question_rows = (
        db.query(QuestionCandidate)
        .filter(
            QuestionCandidate.analysis_id
            == analysis_id
        )
        .order_by(
            QuestionCandidate.created_at.asc()
        )
        .all()
    )

    candidates = [
        StoredKnowledgeCandidate(
            candidate_id=row.candidate_id,
            statement=row.statement,
            knowledge_type=row.knowledge_type,
            context=row.context or {},
            decision_rule=row.decision_rule,
            rationale=row.rationale,
            exception=row.exception,
            novelty_score=decimal_to_float(
                row.novelty_score
            ),
            confidence_score=decimal_to_float(
                row.confidence_score
            ),
            validation_status=(
                row.validation_status
            ),
        )
        for row in candidate_rows
    ]

    gaps = [
        StoredKnowledgeGap(
            gap_id=row.gap_id,
            topic=row.topic,
            dimension=row.dimension,
            gap_type=row.gap_type,
            gap_score=decimal_to_float(
                row.gap_score
            ),
            reason=row.reason,
        )
        for row in gap_rows
    ]

    conflicts = []

    for row in conflict_rows:

        source_rows = (
            db.query(ConflictSource)
            .filter(
                ConflictSource.conflict_id
                == row.conflict_id
            )
            .order_by(
                ConflictSource.created_at.asc()
            )
            .all()
        )

        sources = [
            StoredConflictSource(
                conflict_source_id=(
                    source.conflict_source_id
                ),
                source_type=source.source_type,
                source_id=source.source_id,
                content=source.content,
            )
            for source in source_rows
        ]

        conflicts.append(
            StoredKnowledgeConflict(
                conflict_id=row.conflict_id,
                conflict_type=row.conflict_type,
                severity=row.severity,
                description=row.description,
                context_difference=(
                    row.context_difference
                ),
                unknown_condition=(
                    row.unknown_condition
                ),
                recommended_question=(
                    row.recommended_question
                ),
                sources=sources,
            )
        )

    questions = [
        StoredQuestionCandidate(
            question_id=row.question_id,
            question=row.question,
            question_type=row.question_type,
            target_gap=row.target_gap,
            gap_reduction_score=decimal_to_float(
                row.gap_reduction_score
            ),
            novelty_score=decimal_to_float(
                row.novelty_score
            ),
            business_impact_score=decimal_to_float(
                row.business_impact_score
            ),
            conflict_resolution_score=decimal_to_float(
                row.conflict_resolution_score
            ),
            redundancy_score=decimal_to_float(
                row.redundancy_score
            ),
            value_score=decimal_to_float(
                row.value_score
            ),
            is_selected=row.is_selected,
            assistant_message_id=(
                row.assistant_message_id
            ),
        )
        for row in question_rows
    ]

    return InterviewAnalysisDetailResponse(
        analysis_id=analysis.analysis_id,
        mission_id=analysis.mission_id,
        interview_id=analysis.interview_id,
        source_message_id=(
            analysis.source_message_id
        ),
        assistant_message_id=(
            analysis.assistant_message_id
        ),
        request_context=(
            analysis.request_context or {}
        ),
        raw_response=(
            analysis.raw_response or {}
        ),
        knowledge_candidates=candidates,
        gaps=gaps,
        conflicts=conflicts,
        question_candidates=questions,
        created_at=analysis.created_at,
    )