import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class StoredKnowledgeCandidate(BaseModel):
    candidate_id: uuid.UUID

    statement: str
    knowledge_type: str

    context: dict[str, Any]
    decision_rule: dict[str, Any] | None

    rationale: str | None
    exception: str | None

    novelty_score: float | None
    confidence_score: float | None

    validation_status: str


class StoredKnowledgeGap(BaseModel):
    gap_id: uuid.UUID

    topic: str
    dimension: str
    gap_type: str

    gap_score: float | None

    reason: str


class StoredConflictSource(BaseModel):
    conflict_source_id: uuid.UUID

    source_type: str
    source_id: str | None

    content: str


class StoredKnowledgeConflict(BaseModel):
    conflict_id: uuid.UUID

    conflict_type: str
    severity: str

    description: str

    context_difference: str | None
    unknown_condition: str | None
    recommended_question: str | None

    sources: list[StoredConflictSource]


class StoredQuestionCandidate(BaseModel):
    question_id: uuid.UUID

    question: str
    question_type: str

    target_gap: str | None

    gap_reduction_score: float | None
    novelty_score: float | None
    business_impact_score: float | None
    conflict_resolution_score: float | None
    redundancy_score: float | None
    value_score: float | None

    is_selected: bool

    assistant_message_id: uuid.UUID | None


class InterviewAnalysisDetailResponse(BaseModel):
    analysis_id: uuid.UUID

    mission_id: uuid.UUID
    interview_id: uuid.UUID

    source_message_id: uuid.UUID
    assistant_message_id: uuid.UUID | None

    request_context: dict[str, Any]
    raw_response: dict[str, Any]

    knowledge_candidates: list[
        StoredKnowledgeCandidate
    ]

    gaps: list[
        StoredKnowledgeGap
    ]

    conflicts: list[
        StoredKnowledgeConflict
    ]

    question_candidates: list[
        StoredQuestionCandidate
    ]

    created_at: datetime