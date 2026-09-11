import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.knowledge_synthesis import (
    SynthesisContext,
    SynthesisDecisionRule,
)


KnowledgeType = Literal[
    "FACT",
    "PRINCIPLE",
    "DECISION_RULE",
    "HEURISTIC",
    "EXCEPTION",
    "FAILURE_LESSON",
    "TRADE_OFF",
    "EXPERT_OPINION",
]


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


class KnowledgeCandidateEditRequest(BaseModel):
    statement: str | None = None
    knowledge_type: KnowledgeType | None = None
    context: SynthesisContext | None = None
    decision_rule: SynthesisDecisionRule | None = None
    rationale: str | None = None
    exception: str | None = None

    edit_reason: str | None = Field(
        default=None,
        max_length=2000,
    )
    edited_by: str | None = Field(
        default=None,
        max_length=200,
    )


class KnowledgeCandidateEditResponse(BaseModel):
    candidate_id: uuid.UUID
    analysis_id: uuid.UUID

    statement: str
    knowledge_type: str
    context: dict[str, Any]
    decision_rule: dict[str, Any] | None = None
    rationale: str | None = None
    exception: str | None = None

    validation_status: str
    review_status: str
    review_reason: str | None = None
    review_synthesis_id: uuid.UUID | None = None

    invalidated_synthesis_ids: list[uuid.UUID] = Field(
        default_factory=list
    )
    resynthesis_required: bool = True
