import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


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


class ContextTags(BaseModel):
    project: str | None = None
    phase: str | None = None
    domain: str | None = None
    system: str | None = None
    scope: str | None = None
    time: str | None = None

    constraints: list[str] = Field(
        default_factory=list,
    )

    tags: list[str] = Field(
        default_factory=list,
    )


class InterviewContextPreviewRequest(BaseModel):
    message_id: uuid.UUID

    include_retrieval: bool = True

    knowledge_top_k: int = Field(
        default=5,
        ge=1,
        le=20,
    )

    evidence_top_k: int = Field(
        default=3,
        ge=1,
        le=20,
    )

    history_limit: int = Field(
        default=20,
        ge=1,
        le=100,
    )


class MissionContextItem(BaseModel):
    mission_id: uuid.UUID
    title: str
    domain: str
    objective: str | None


class InterviewContextItem(BaseModel):
    interview_id: uuid.UUID
    expert_id: uuid.UUID

    title: str | None
    status: str


class CurrentMessageItem(BaseModel):
    message_id: uuid.UUID

    role: str
    content: str

    sequence: int
    created_at: datetime


class ConversationMessageItem(BaseModel):
    message_id: uuid.UUID

    role: str
    content: str

    sequence: int
    created_at: datetime


class RetrievedKnowledgeItem(BaseModel):
    claim_id: uuid.UUID

    claim_type: str
    statement: str

    similarity: float

    source_chunk_id: uuid.UUID

    document_id: uuid.UUID | None = None
    file_name: str | None = None
    page: int | None = None
    section: str | None = None


class RetrievedKnowledgeUnitItem(BaseModel):
    knowledge_id: uuid.UUID

    knowledge_type: KnowledgeType
    statement: str

    context: ContextTags = Field(
        default_factory=ContextTags,
    )

    validation_status: Literal[
        "VERIFIED"
    ]

    version: int = Field(
        ge=1,
    )

    confidence_score: float | None = Field(
        default=None,
        ge=0,
        le=1,
    )

    similarity: float | None = Field(
        default=None,
        ge=0,
        le=1,
    )

    decision_rule: dict[
        str,
        Any,
    ] | None = None

    rationale: str | None = None
    exception: str | None = None


class RetrievedEvidenceItem(BaseModel):
    chunk_id: uuid.UUID

    content: str
    similarity: float

    document_id: uuid.UUID | None = None
    file_name: str | None = None
    page: int | None = None
    section: str | None = None


class InterviewContextPreviewResponse(BaseModel):
    schema_version: str = "1.0"

    mission: MissionContextItem
    interview: InterviewContextItem
    message: CurrentMessageItem

    conversation_context: list[
        ConversationMessageItem
    ]

    retrieved_knowledge: list[
        RetrievedKnowledgeItem
    ]

    retrieved_knowledge_units: list[
        RetrievedKnowledgeUnitItem
    ]

    retrieved_evidence: list[
        RetrievedEvidenceItem
    ]