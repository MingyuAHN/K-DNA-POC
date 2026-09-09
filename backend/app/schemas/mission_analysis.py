import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class MissionKnowledgeGapResponse(BaseModel):
    gap_id: uuid.UUID

    mission_id: uuid.UUID
    interview_id: uuid.UUID
    analysis_id: uuid.UUID

    topic: str
    dimension: str
    gap_type: str

    gap_score: float | None

    reason: str

    created_at: datetime


class MissionKnowledgeGapListResponse(BaseModel):
    total: int

    gaps: list[
        MissionKnowledgeGapResponse
    ] = Field(
        default_factory=list
    )


class MissionConflictSourceResponse(BaseModel):
    conflict_source_id: uuid.UUID

    source_type: str
    source_id: str | None

    content: str

    created_at: datetime


class MissionKnowledgeConflictResponse(BaseModel):
    conflict_id: uuid.UUID

    mission_id: uuid.UUID
    interview_id: uuid.UUID
    analysis_id: uuid.UUID

    conflict_type: str
    severity: str

    description: str

    context_difference: str | None
    unknown_condition: str | None
    recommended_question: str | None

    sources: list[
        MissionConflictSourceResponse
    ] = Field(
        default_factory=list
    )

    created_at: datetime


class MissionKnowledgeConflictListResponse(BaseModel):
    total: int

    conflicts: list[
        MissionKnowledgeConflictResponse
    ] = Field(
        default_factory=list
    )