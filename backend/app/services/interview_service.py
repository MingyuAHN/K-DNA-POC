import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.interview import Interview
from app.models.interview_message import InterviewMessage
from app.schemas.interview import InterviewCreate
from app.services.expert_service import get_expert
from app.services.mission_service import get_mission


def get_interview(
    db: Session,
    interview_id: uuid.UUID,
) -> Interview | None:

    return (
        db.query(Interview)
        .filter(
            Interview.interview_id == interview_id
        )
        .first()
    )


def create_interview(
    db: Session,
    mission_id: uuid.UUID,
    request: InterviewCreate,
) -> Interview:

    mission = get_mission(
        db=db,
        mission_id=mission_id,
    )

    if mission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )

    expert = get_expert(
        db=db,
        expert_id=request.expert_id,
    )

    if expert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expert not found",
        )

    interview = Interview(
        mission_id=mission_id,
        expert_id=request.expert_id,
        title=request.title,
        status="CREATED",
    )

    db.add(interview)
    db.commit()
    db.refresh(interview)

    return interview


def complete_interview(
    db: Session,
    interview_id: uuid.UUID,
) -> Interview:
    """
    사용자가 인터뷰 종료 버튼을 눌렀을 때
    Interview를 COMPLETED 상태로 변경한다.
    """

    interview = get_interview(
        db=db,
        interview_id=interview_id,
    )

    if interview is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    if interview.status == "COMPLETED":
        return interview

    if interview.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cancelled interview cannot "
                "be completed"
            ),
        )

    interview.status = "COMPLETED"
    interview.ended_at = datetime.now(
        timezone.utc
    )

    db.commit()
    db.refresh(interview)

    return interview


def add_interview_message(
    db: Session,
    interview_id: uuid.UUID,
    role: str,
    content: str,
) -> InterviewMessage:

    interview = get_interview(
        db=db,
        interview_id=interview_id,
    )

    if interview is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    # ---------------------------------------------------------
    # 종료된 Interview에는 메시지 추가 불가
    # ---------------------------------------------------------
    if interview.status == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Interview is already completed",
        )

    if interview.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Interview is cancelled",
        )

    if not content or not content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content is required",
        )

    role = role.upper()

    if role not in {
        "USER",
        "ASSISTANT",
        "SYSTEM",
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid message role",
        )

    current_max_sequence = (
        db.query(
            func.max(
                InterviewMessage.sequence
            )
        )
        .filter(
            InterviewMessage.interview_id
            == interview_id
        )
        .scalar()
    )

    next_sequence = (
        0
        if current_max_sequence is None
        else current_max_sequence + 1
    )

    message = InterviewMessage(
        interview_id=interview_id,
        role=role,
        content=content.strip(),
        sequence=next_sequence,
    )

    db.add(message)

    if interview.status == "CREATED":
        interview.status = "IN_PROGRESS"
        interview.started_at = datetime.now(
            timezone.utc
        )

    db.commit()
    db.refresh(message)

    return message


def get_interview_messages(
    db: Session,
    interview_id: uuid.UUID,
) -> list[InterviewMessage]:

    interview = get_interview(
        db=db,
        interview_id=interview_id,
    )

    if interview is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    return (
        db.query(InterviewMessage)
        .filter(
            InterviewMessage.interview_id
            == interview_id
        )
        .order_by(
            InterviewMessage.sequence.asc()
        )
        .all()
    )