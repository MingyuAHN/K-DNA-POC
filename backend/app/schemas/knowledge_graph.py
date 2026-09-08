import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


KnowledgeRelationType = Literal[
    "SUPPORTS",
    "REFINES",
    "HAS_EXCEPTION",
    "CONTRADICTS",
    "CONTEXT_DIFFERS",
    "SUPERSEDES",
    "UNRELATED",
]


class KnowledgeRelationCreate(BaseModel):
    from_knowledge_id: uuid.UUID
    to_knowledge_id: uuid.UUID

    relation_type: KnowledgeRelationType

    confidence_score: float | None = Field(
        default=None,
        ge=0,
        le=1,
    )

    source_analysis_id: uuid.UUID | None = None


class KnowledgeRelationResponse(BaseModel):
    relation_id: uuid.UUID
    mission_id: uuid.UUID

    from_knowledge_id: uuid.UUID
    to_knowledge_id: uuid.UUID

    relation_type: str
    confidence_score: float | None

    source_analysis_id: uuid.UUID | None

    created_at: datetime


class KnowledgeGraphNode(BaseModel):
    knowledge_id: uuid.UUID

    knowledge_type: str
    statement: str

    context: dict[str, Any]

    status: str
    confidence_score: float | None

    version: int

    root_knowledge_id: uuid.UUID | None
    supersedes_id: uuid.UUID | None


class KnowledgeGraphEdge(BaseModel):
    relation_id: uuid.UUID

    source: uuid.UUID
    target: uuid.UUID

    relation_type: str
    confidence_score: float | None

    source_analysis_id: uuid.UUID | None


class KnowledgeGraphResponse(BaseModel):
    mission_id: uuid.UUID

    node_count: int
    edge_count: int

    nodes: list[KnowledgeGraphNode]
    edges: list[KnowledgeGraphEdge]