import uuid
from datetime import datetime

from pydantic import BaseModel, Field


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

    retrieved_evidence: list[
        RetrievedEvidenceItem
    ]