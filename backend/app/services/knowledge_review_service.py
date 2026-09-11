import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.interview_analysis import (
    InterviewAnalysis,
    KnowledgeCandidate,
)
from app.models.knowledge_core import KnowledgeUnit
from app.models.knowledge_synthesis import KnowledgeSynthesis
from app.schemas.knowledge_review import (
    KnowledgeCandidateEditRequest,
    KnowledgeCandidateEditResponse,
    KnowledgeReviewCandidateItem,
    KnowledgeReviewCandidateListResponse,
)
from app.services.mission_service import get_mission


EDITABLE_CANDIDATE_FIELDS = {
    "statement",
    "knowledge_type",
    "context",
    "decision_rule",
    "rationale",
    "exception",
}

ACTIVE_SYNTHESIS_STATUSES = {
    "PENDING",
    "APPROVED",
}

REVIEW_EDIT_VALIDATED_BY = "K-DNA REVIEW EDIT"


def _float_or_none(value) -> float | None:
    if value is None:
        return None

    return float(value)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _build_review_reason(
    request: KnowledgeCandidateEditRequest,
) -> str:
    parts = []

    if request.edited_by and request.edited_by.strip():
        parts.append(
            f"Candidate edited by {request.edited_by.strip()}"
        )
    else:
        parts.append("Candidate edited")

    parts.append("re-synthesis required")

    if request.edit_reason and request.edit_reason.strip():
        parts.append(request.edit_reason.strip())

    return "; ".join(parts)


def edit_review_candidate(
    db: Session,
    candidate_id: uuid.UUID,
    request: KnowledgeCandidateEditRequest,
) -> KnowledgeCandidateEditResponse:
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge candidate not found",
        )

    if candidate.validation_status != "CANDIDATE":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only CANDIDATE knowledge can be edited"
            ),
        )

    existing_knowledge = (
        db.query(KnowledgeUnit)
        .filter(
            KnowledgeUnit.source_candidate_id
            == candidate_id
        )
        .first()
    )

    if existing_knowledge is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Candidate already has an applied "
                "Knowledge Unit and cannot be edited"
            ),
        )

    syntheses = (
        db.query(KnowledgeSynthesis)
        .filter(
            KnowledgeSynthesis.candidate_id
            == candidate_id
        )
        .order_by(
            KnowledgeSynthesis.created_at.desc()
        )
        .all()
    )

    if any(
        synthesis.status == "APPLIED"
        for synthesis in syntheses
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Candidate already has an APPLIED "
                "synthesis and cannot be edited"
            ),
        )

    changed_fields = (
        request.model_fields_set
        & EDITABLE_CANDIDATE_FIELDS
    )

    if not changed_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "At least one editable candidate field "
                "must be provided"
            ),
        )

    if "statement" in changed_fields:
        if request.statement is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="statement cannot be null",
            )

        statement = request.statement.strip()

        if not statement:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="statement cannot be blank",
            )

        candidate.statement = statement

    if "knowledge_type" in changed_fields:
        if request.knowledge_type is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="knowledge_type cannot be null",
            )

        candidate.knowledge_type = request.knowledge_type

    if "context" in changed_fields:
        if request.context is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="context cannot be null",
            )

        candidate.context = request.context.model_dump(
            mode="json"
        )

    if "decision_rule" in changed_fields:
        candidate.decision_rule = (
            request.decision_rule.model_dump(
                mode="json"
            )
            if request.decision_rule is not None
            else None
        )

    if "rationale" in changed_fields:
        candidate.rationale = (
            request.rationale.strip()
            if request.rationale is not None
            and request.rationale.strip()
            else None
        )

    if "exception" in changed_fields:
        candidate.exception = (
            request.exception.strip()
            if request.exception is not None
            and request.exception.strip()
            else None
        )

    now = _utcnow()
    invalidated_synthesis_ids: list[uuid.UUID] = []

    for synthesis in syntheses:
        if synthesis.status not in ACTIVE_SYNTHESIS_STATUSES:
            continue

        synthesis.status = "STALE"
        synthesis.validated_by = (
            request.edited_by.strip()
            if request.edited_by
            and request.edited_by.strip()
            else REVIEW_EDIT_VALIDATED_BY
        )
        synthesis.validation_reason = (
            "Candidate edited; synthesis invalidated "
            "and re-synthesis is required"
        )
        synthesis.validated_at = now

        invalidated_synthesis_ids.append(
            synthesis.synthesis_id
        )

    review_reason = _build_review_reason(request)

    candidate.review_status = "REVIEW_REQUIRED"
    candidate.review_reason = review_reason
    candidate.review_synthesis_id = None

    try:
        db.commit()
        db.refresh(candidate)

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Knowledge candidate edit failed: "
                f"{str(exc)}"
            ),
        )

    return KnowledgeCandidateEditResponse(
        candidate_id=candidate.candidate_id,
        analysis_id=candidate.analysis_id,
        statement=candidate.statement,
        knowledge_type=candidate.knowledge_type,
        context=candidate.context or {},
        decision_rule=candidate.decision_rule,
        rationale=candidate.rationale,
        exception=candidate.exception,
        validation_status=candidate.validation_status,
        review_status=(
            candidate.review_status
            or "REVIEW_REQUIRED"
        ),
        review_reason=candidate.review_reason,
        review_synthesis_id=(
            candidate.review_synthesis_id
        ),
        invalidated_synthesis_ids=(
            invalidated_synthesis_ids
        ),
        resynthesis_required=True,
    )


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

    latest_active_synthesis_by_candidate: dict[
        uuid.UUID,
        KnowledgeSynthesis,
    ] = {}

    for synthesis in synthesis_rows:
        if synthesis.status not in ACTIVE_SYNTHESIS_STATUSES:
            continue

        if (
            synthesis.candidate_id
            not in latest_active_synthesis_by_candidate
        ):
            latest_active_synthesis_by_candidate[
                synthesis.candidate_id
            ] = synthesis

    items: list[KnowledgeReviewCandidateItem] = []

    for candidate, analysis in rows:
        synthesis = None

        if candidate.review_synthesis_id is not None:
            synthesis = synthesis_by_id.get(
                candidate.review_synthesis_id
            )

            if (
                synthesis is not None
                and synthesis.status
                not in ACTIVE_SYNTHESIS_STATUSES
            ):
                synthesis = None

        # Low-confidence REVIEW_REQUIRED는 Auto Sync 시점에
        # 아직 Synthesis가 없을 수 있다.
        #
        # Edit 직후에는 이전 PENDING Synthesis가 STALE이므로
        # Review 화면에 노출하지 않는다. 이후 재-Synthesize가
        # 수행되면 가장 최근 PENDING/APPROVED Synthesis를 노출한다.
        if synthesis is None:
            synthesis = (
                latest_active_synthesis_by_candidate.get(
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
                knowledge_type=candidate.knowledge_type,
                context=candidate.context or {},
                decision_rule=candidate.decision_rule,
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
                review_reason=candidate.review_reason,
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
