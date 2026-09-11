import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class KnowledgeReviewCandidateItem(BaseModel):
    candidate_id: uuid.UUID
    analysis_id: uuid.UUID
    interview_id: uuid.UUID
    source_message_id: uuid.UUID

    statement: str
    knowledge_type: str
    context: dict[str, Any]
    decision_rule: dict[str, Any] | None = None
    rationale: str | None = None
    exception: str | None = None

    novelty_score: float | None = None
    confidence_score: float | None = None
    validation_status: str

    review_status: str
    review_reason: str | None = None

    synthesis_id: uuid.UUID | None = None
    synthesis_status: str | None = None
    synthesis_operation: str | None = None
    synthesis_reason: str | None = None

    created_at: datetime


class KnowledgeReviewCandidateListResponse(BaseModel):
    mission_id: uuid.UUID
    total: int
    candidates: list[KnowledgeReviewCandidateItem]
