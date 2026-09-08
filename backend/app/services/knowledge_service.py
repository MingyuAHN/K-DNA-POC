import uuid

from fastapi import HTTPException, status
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
    KnowledgeUnit,
    Validation,
)
from app.schemas.knowledge import (
    KnowledgeCandidateValidationRequest,
)


PROMOTABLE_STATUSES = {
    "VERIFIED",
    "EXPERT_OPINION",
}


def get_knowledge_candidate(
    db: Session,
    candidate_id: uuid.UUID,
) -> KnowledgeCandidate | None:

    return (
        db.query(KnowledgeCandidate)
        .filter(
            KnowledgeCandidate.candidate_id
            == candidate_id
        )
        .first()
    )


def validate_knowledge_candidate(
    db: Session,
    candidate_id: uuid.UUID,
    request: KnowledgeCandidateValidationRequest,
) -> tuple[
    Validation,
    KnowledgeUnit | None,
]:

    candidate = get_knowledge_candidate(
        db=db,
        candidate_id=candidate_id,
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

    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview analysis not found",
        )

    try:
        candidate.validation_status = (
            request.status
        )

        knowledge_unit = None

        # ------------------------------------
        # VERIFIED / EXPERT_OPINION인 경우
        # Knowledge Unit으로 승격
        # ------------------------------------
        if request.status in PROMOTABLE_STATUSES:

            knowledge_unit = (
                db.query(KnowledgeUnit)
                .filter(
                    KnowledgeUnit.source_candidate_id
                    == candidate.candidate_id
                )
                .first()
            )

            if knowledge_unit is None:

                knowledge_unit = KnowledgeUnit(
                    mission_id=analysis.mission_id,
                    source_candidate_id=(
                        candidate.candidate_id
                    ),
                    knowledge_type=(
                        candidate.knowledge_type
                    ),
                    statement=candidate.statement,
                    context=candidate.context,
                    decision_rule=(
                        candidate.decision_rule
                    ),
                    rationale=candidate.rationale,
                    exception=candidate.exception,
                    status=request.status,
                    confidence_score=(
                        candidate.confidence_score
                    ),
                    version=1,
                )

                db.add(knowledge_unit)
                db.flush()

                # --------------------------------
                # Expert 답변을 Evidence로 연결
                # --------------------------------
                source_message = (
                    db.query(InterviewMessage)
                    .filter(
                        InterviewMessage.message_id
                        == analysis.source_message_id
                    )
                    .first()
                )

                if source_message is not None:

                    evidence = Evidence(
                        knowledge_id=(
                            knowledge_unit.knowledge_id
                        ),
                        source_type=(
                            "INTERVIEW_MESSAGE"
                        ),
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
                            "interview_id": str(
                                analysis.interview_id
                            ),
                            "analysis_id": str(
                                analysis.analysis_id
                            ),
                        },
                    )

                    db.add(evidence)

        # ------------------------------------
        # Validation History 저장
        # ------------------------------------
        validation = Validation(
            candidate_id=candidate.candidate_id,
            knowledge_id=(
                knowledge_unit.knowledge_id
                if knowledge_unit is not None
                else None
            ),
            validation_type="HUMAN",
            status=request.status,
            reason=request.reason,
            validated_by=request.validated_by,
        )

        db.add(validation)

        db.commit()

        db.refresh(validation)

        if knowledge_unit is not None:
            db.refresh(knowledge_unit)

        return (
            validation,
            knowledge_unit,
        )

    except HTTPException:
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Knowledge validation failed: "
                f"{str(exc)}"
            ),
        )


def get_mission_knowledge_units(
    db: Session,
    mission_id: uuid.UUID,
) -> list[KnowledgeUnit]:

    return (
        db.query(KnowledgeUnit)
        .filter(
            KnowledgeUnit.mission_id
            == mission_id
        )
        .order_by(
            KnowledgeUnit.created_at.asc()
        )
        .all()
    )


def get_knowledge_unit(
    db: Session,
    knowledge_id: uuid.UUID,
) -> KnowledgeUnit | None:

    return (
        db.query(KnowledgeUnit)
        .filter(
            KnowledgeUnit.knowledge_id
            == knowledge_id
        )
        .first()
    )


def get_knowledge_evidence(
    db: Session,
    knowledge_id: uuid.UUID,
) -> list[Evidence]:

    return (
        db.query(Evidence)
        .filter(
            Evidence.knowledge_id
            == knowledge_id
        )
        .order_by(
            Evidence.created_at.asc()
        )
        .all()
    )