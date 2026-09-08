import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class InterviewCreate(BaseModel):
    expert_id: uuid.UUID
    title: str | None = None


class InterviewResponse(BaseModel):
    interview_id: uuid.UUID
    mission_id: uuid.UUID
    expert_id: uuid.UUID

    title: str | None
    status: str

    started_at: datetime | None
    ended_at: datetime | None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class InterviewMessageCreate(BaseModel):
    content: str


class InterviewMessageResponse(BaseModel):
    message_id: uuid.UUID
    interview_id: uuid.UUID

    role: str
    content: str
    sequence: int

    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class InterviewHistoryResponse(BaseModel):
    interview_id: uuid.UUID
    messages: list[InterviewMessageResponse]