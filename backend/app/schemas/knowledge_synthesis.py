import uuid
from typing import Literal

from pydantic import BaseModel, Field


SynthesisOperation = Literal[
    "ENRICH",
    "ADD_EXCEPTION",
    "SPLIT_BY_CONTEXT",
    "MERGE",
    "SUPERSEDE",
    "KEEP_CONFLICT",
]


SynthesisRelationType = Literal[
    "SUPPORTS",
    "REFINES",
    "HAS_EXCEPTION",
    "CONTRADICTS",
    "CONTEXT_DIFFERS",
    "SUPERSEDES",
    "UNRELATED",
]


AutoKnowledgeSyncItemStatus = Literal[
    "APPLIED",
    "SKIPPED",
    "FAILED",
]


class SynthesisContext(BaseModel):
    project: str | None = None
    phase: str | None = None
    domain: str | None = None
    system: str | None = None
    scope: str | None = None
    time: str | None = None

    constraints: list[str] = Field(
        default_factory=list
    )

    tags: list[str] = Field(
        default_factory=list
    )


class SynthesisDecisionRule(BaseModel):
    if_conditions: list[str] = Field(
        default_factory=list
    )

    then: str

    unless: list[str] = Field(
        default_factory=list
    )


class SynthesisCandidate(BaseModel):
    statement: str
    type: str

    context: SynthesisContext

    decision_rule: (
        SynthesisDecisionRule | None
    ) = None

    rationale: str | None = None
    exception: str | None = None

    novelty_score: float = Field(
        ...,
        ge=0,
        le=1,
    )

    confidence_score: float = Field(
        ...,
        ge=0,
        le=1,
    )

    validation_status: str


class ExistingKnowledge(BaseModel):
    knowledge_id: uuid.UUID

    statement: str
    type: str

    context: dict

    decision_rule: dict | None = None

    rationale: str | None = None
    exception: str | None = None

    confidence_score: float | None = Field(
        default=None,
        ge=0,
        le=1,
    )

    validation_status: str


class KnowledgeSynthesisAIRequest(BaseModel):
    candidate: SynthesisCandidate

    existing_knowledge: list[
        ExistingKnowledge
    ]


class SynthesizedKnowledgeUnit(BaseModel):
    statement: str
    type: str

    context: SynthesisContext

    decision_rule: (
        SynthesisDecisionRule | None
    ) = None

    rationale: str | None = None
    exception: str | None = None

    novelty_score: float = Field(
        ...,
        ge=0,
        le=1,
    )

    confidence_score: float = Field(
        ...,
        ge=0,
        le=1,
    )

    validation_status: str


class ProposedSynthesisRelation(BaseModel):
    synthesized_index: int = Field(
        ...,
        ge=0,
    )

    target_knowledge_id: uuid.UUID

    relation: SynthesisRelationType

    reason: str | None = None


class KnowledgeSynthesisAIResponse(BaseModel):
    operation: SynthesisOperation

    target_knowledge_ids: list[
        uuid.UUID
    ] = Field(default_factory=list)

    synthesized_knowledge_units: list[
        SynthesizedKnowledgeUnit
    ] = Field(default_factory=list)

    relations: list[
        ProposedSynthesisRelation
    ] = Field(default_factory=list)

    reason: str | None = None


# ---------------------------------------------------------
# Backend API
# ---------------------------------------------------------


class KnowledgeSynthesisRequest(BaseModel):
    related_knowledge_ids: list[
        uuid.UUID
    ] = Field(
        default_factory=list,
        max_length=20,
    )


class StoredSynthesizedKnowledgeUnit(
    SynthesizedKnowledgeUnit
):
    synthesis_unit_id: uuid.UUID
    synthesized_index: int


class StoredSynthesisRelation(BaseModel):
    synthesis_relation_id: uuid.UUID

    synthesized_index: int

    target_knowledge_id: uuid.UUID

    relation: SynthesisRelationType

    reason: str | None = None


class KnowledgeSynthesisResponse(BaseModel):
    synthesis_id: uuid.UUID

    candidate_id: uuid.UUID
    mission_id: uuid.UUID

    operation: SynthesisOperation

    target_knowledge_ids: list[
        uuid.UUID
    ]

    synthesized_knowledge_units: list[
        StoredSynthesizedKnowledgeUnit
    ]

    relations: list[
        StoredSynthesisRelation
    ]

    reason: str | None


# ---------------------------------------------------------
# Auto Knowledge Sync
# ---------------------------------------------------------


class AutoKnowledgeSyncItem(BaseModel):
    candidate_id: uuid.UUID

    status: AutoKnowledgeSyncItemStatus

    synthesis_id: (
        uuid.UUID | None
    ) = None

    resulting_knowledge_ids: list[
        uuid.UUID
    ] = Field(
        default_factory=list
    )

    detail: str | None = None


class AutoKnowledgeSyncResponse(BaseModel):
    analysis_id: uuid.UUID
    mission_id: uuid.UUID

    total_candidates: int

    processed: int
    skipped: int
    failed: int

    items: list[
        AutoKnowledgeSyncItem
    ] = Field(
        default_factory=list
    )