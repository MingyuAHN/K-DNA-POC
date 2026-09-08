import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ExpertCreate(BaseModel):
    name: str
    organization: str | None = None
    role: str | None = None


class ExpertResponse(BaseModel):
    expert_id: uuid.UUID

    name: str
    organization: str | None
    role: str | None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )