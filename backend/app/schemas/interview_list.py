import uuid

from pydantic import BaseModel

from app.schemas.interview import (
    InterviewResponse,
)


class MissionInterviewListResponse(
    BaseModel
):
    mission_id: uuid.UUID

    total: int

    interviews: list[
        InterviewResponse
    ]