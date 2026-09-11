import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.interview_analysis import (
    InterviewAnalysis,
    KnowledgeCandidate,
)
from app.models.knowledge_synthesis import (
    KnowledgeSynthesis,
)
from app.schemas.knowledge_review import (
    KnowledgeReviewCandidateItem,
    KnowledgeReviewCandidateListResponse,
)
from app.services.mission_service import (
    get_mission,
)


def _float_or_none(value) -> float | None:
    if value is None:
        return None

    return float(value)


def get_mission_review_candidates(
    db: Session,
    mission_id: uuid.UUID,
) -> KnowledgeReviewCandidateListResponse:
    mission = get_mission(
        db=db,
        mission_id=mission_id,
    )

    if mission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )

    rows = (
        db.query(
            KnowledgeCandidate,
            InterviewAnalysis,
        )
        .join(
            InterviewAnalysis,
            InterviewAnalysis.analysis_id
            == KnowledgeCandidate.analysis_id,
        )
        .filter(
            InterviewAnalysis.mission_id
            == mission_id,
            KnowledgeCandidate.review_status
            == "REVIEW_REQUIRED",
            KnowledgeCandidate.validation_status
            == "CANDIDATE",
        )
        .order_by(
            KnowledgeCandidate.created_at.desc()
        )
        .all()
    )

    if not rows:
        return KnowledgeReviewCandidateListResponse(
            mission_id=mission_id,
            total=0,
            candidates=[],
        )

    candidate_ids = [
        candidate.candidate_id
        for candidate, _ in rows
    ]

    synthesis_rows = (
        db.query(KnowledgeSynthesis)
        .filter(
            KnowledgeSynthesis.candidate_id.in_(
                candidate_ids
            )
        )
        .order_by(
            KnowledgeSynthesis.created_at.desc()
        )
        .all()
    )

    synthesis_by_id = {
        synthesis.synthesis_id: synthesis
        for synthesis in synthesis_rows
    }

    latest_synthesis_by_candidate: dict[
        uuid.UUID,
        KnowledgeSynthesis,
    ] = {}

    for synthesis in synthesis_rows:
        if (
            synthesis.candidate_id
            not in latest_synthesis_by_candidate
        ):
            latest_synthesis_by_candidate[
                synthesis.candidate_id
            ] = synthesis

    items: list[
        KnowledgeReviewCandidateItem
    ] = []

    for candidate, analysis in rows:
        synthesis = None

        if candidate.review_synthesis_id is not None:
            synthesis = synthesis_by_id.get(
                candidate.review_synthesis_id
            )

        # Low-confidence REVIEW_REQUIRED는 Auto Sync 시점에
        # 아직 Synthesis가 없을 수 있다.
        #
        # 이후 Review 화면에서 사용자가 수동 synthesize를
        # 호출한 경우 review_synthesis_id가 아직 비어 있어도
        # 가장 최근 Synthesis를 함께 내려준다.
        if synthesis is None:
            synthesis = (
                latest_synthesis_by_candidate.get(
                    candidate.candidate_id
                )
            )

        items.append(
            KnowledgeReviewCandidateItem(
                candidate_id=candidate.candidate_id,
                analysis_id=analysis.analysis_id,
                interview_id=analysis.interview_id,
                source_message_id=(
                    analysis.source_message_id
                ),
                statement=candidate.statement,
                knowledge_type=(
                    candidate.knowledge_type
                ),
                context=candidate.context or {},
                decision_rule=(
                    candidate.decision_rule
                ),
                rationale=candidate.rationale,
                exception=candidate.exception,
                novelty_score=_float_or_none(
                    candidate.novelty_score
                ),
                confidence_score=_float_or_none(
                    candidate.confidence_score
                ),
                validation_status=(
                    candidate.validation_status
                ),
                review_status=(
                    candidate.review_status
                    or "REVIEW_REQUIRED"
                ),
                review_reason=(
                    candidate.review_reason
                ),
                synthesis_id=(
                    synthesis.synthesis_id
                    if synthesis is not None
                    else None
                ),
                synthesis_status=(
                    synthesis.status
                    if synthesis is not None
                    else None
                ),
                synthesis_operation=(
                    synthesis.operation
                    if synthesis is not None
                    else None
                ),
                synthesis_reason=(
                    synthesis.reason
                    if synthesis is not None
                    else None
                ),
                created_at=candidate.created_at,
            )
        )

    return KnowledgeReviewCandidateListResponse(
        mission_id=mission_id,
        total=len(items),
        candidates=items,
    )
