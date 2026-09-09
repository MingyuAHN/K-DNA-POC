import uuid
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


class MissionCreate(BaseModel):
    title: str
    domain: str
    objective: str | None = None


class MissionResponse(BaseModel):
    mission_id: uuid.UUID
    title: str
    domain: str
    objective: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class MissionListResponse(BaseModel):
    total: int

    missions: list[
        MissionResponse
    ] = Field(
        default_factory=list
    )