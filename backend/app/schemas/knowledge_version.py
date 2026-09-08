import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class KnowledgeVersionCreate(BaseModel):
    statement: str | None = Field(
        default=None,
        min_length=1,
    )

    context: dict[str, Any] | None = None

    decision_rule: dict[str, Any] | None = None

    rationale: str | None = None

    exception: str | None = None

    confidence_score: float | None = Field(
        default=None,
        ge=0,
        le=1,
    )

    change_reason: str = Field(
        ...,
        min_length=1,
    )


class KnowledgeVersionResponse(BaseModel):
    knowledge_id: uuid.UUID
    mission_id: uuid.UUID

    knowledge_type: str
    statement: str

    context: dict[str, Any]
    decision_rule: dict[str, Any] | None

    rationale: str | None
    exception: str | None

    status: str
    confidence_score: float | None

    version: int

    root_knowledge_id: uuid.UUID | None
    supersedes_id: uuid.UUID | None

    change_reason: str | None

    created_at: datetime
    updated_at: datetime


class KnowledgeVersionHistoryResponse(BaseModel):
    root_knowledge_id: uuid.UUID

    versions: list[
        KnowledgeVersionResponse
    ]