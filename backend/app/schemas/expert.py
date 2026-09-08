import uuid
from datetime import datetime
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


class ExpertCreate(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    organization: str | None = Field(
        default=None,
        max_length=200,
    )

    role: str | None = Field(
        default=None,
        max_length=200,
    )

    metadata: dict[str, Any] = Field(
        default_factory=dict
    )


class ExpertResponse(BaseModel):
    expert_id: uuid.UUID

    name: str
    organization: str | None
    role: str | None

    # ORM에서는 metadata_ 속성을 읽고,
    # API Response에서는 metadata라는 이름으로 반환
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias="metadata_",
    )

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class ExpertListResponse(BaseModel):
    total: int

    experts: list[ExpertResponse]