import uuid

from fastapi import (
    APIRouter,
    Depends,
    status,
)
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.interview import (
    InterviewCreate,
    InterviewHistoryResponse,
    InterviewMessageCreate,
    InterviewMessageResponse,
    InterviewResponse,
)
from app.schemas.interview_context import (
    InterviewContextPreviewRequest,
    InterviewContextPreviewResponse,
)
from app.schemas.interview_list import (
    MissionInterviewListResponse,
)
from app.schemas.interview_orchestration import (
    InterviewTurnRequest,
    InterviewTurnResponse,
)
from app.services.interview_context_service import (
    build_interview_context,
)
from app.services.interview_query_service import (
    get_mission_interviews,
)
from app.services.interview_service import (
    add_interview_message,
    complete_interview,
    create_interview,
    get_interview_messages,
)
from app.services.interview_turn_service import (
    run_interview_turn,
)


router = APIRouter(
    prefix="/api/v1",
    tags=["interviews"],
)


@router.post(
    "/missions/{mission_id}/interviews",
    response_model=InterviewResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_interview_api(
    mission_id: uuid.UUID,
    request: InterviewCreate,
    db: Session = Depends(get_db),
):
    return create_interview(
        db=db,
        mission_id=mission_id,
        request=request,
    )


@router.get(
    "/missions/{mission_id}/interviews",
    response_model=MissionInterviewListResponse,
)
def get_mission_interviews_api(
    mission_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    interviews = get_mission_interviews(
        db=db,
        mission_id=mission_id,
    )

    return MissionInterviewListResponse(
        mission_id=mission_id,
        total=len(interviews),
        interviews=interviews,
    )


@router.post(
    "/interviews/{interview_id}/messages",
    response_model=InterviewMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_interview_message_api(
    interview_id: uuid.UUID,
    request: InterviewMessageCreate,
    db: Session = Depends(get_db),
):
    return add_interview_message(
        db=db,
        interview_id=interview_id,
        role="USER",
        content=request.content,
    )


@router.get(
    "/interviews/{interview_id}/messages",
    response_model=InterviewHistoryResponse,
)
def get_interview_history_api(
    interview_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    messages = get_interview_messages(
        db=db,
        interview_id=interview_id,
    )

    return InterviewHistoryResponse(
        interview_id=interview_id,
        messages=messages,
    )


@router.post(
    "/interviews/{interview_id}/context/preview",
    response_model=InterviewContextPreviewResponse,
)
def preview_interview_context_api(
    interview_id: uuid.UUID,
    request: InterviewContextPreviewRequest,
    db: Session = Depends(get_db),
):
    return build_interview_context(
        db=db,
        interview_id=interview_id,
        request=request,
    )


@router.post(
    "/interviews/{interview_id}/turns",
    response_model=InterviewTurnResponse,
)
def create_interview_turn_api(
    interview_id: uuid.UUID,
    request: InterviewTurnRequest,
    db: Session = Depends(get_db),
):
    return run_interview_turn(
        db=db,
        interview_id=interview_id,
        request=request,
    )


@router.post(
    "/interviews/{interview_id}/complete",
    response_model=InterviewResponse,
)
def complete_interview_api(
    interview_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    return complete_interview(
        db=db,
        interview_id=interview_id,
    )