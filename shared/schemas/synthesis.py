from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from .common import ContextTags
from .enums import (
    KnowledgeType,
    ValidationStatus,
    RelationType,
    SynthesisOperation,
)

from .interview import (
    KnowledgeCandidate,
    DecisionRule,
)


class ExistingKnowledgeUnit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    knowledge_id: str
    statement: str
    type: KnowledgeType
    context: ContextTags

    decision_rule: Optional[DecisionRule] = None
    rationale: Optional[str] = None
    exception: Optional[str] = None

    confidence_score: float = Field(
        ge=0.0,
        le=1.0,
    )

    validation_status: ValidationStatus


class KnowledgeSynthesisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidate: KnowledgeCandidate

    existing_knowledge: List[
        ExistingKnowledgeUnit
    ] = Field(default_factory=list)


class SynthesizedKnowledgeUnit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    statement: str
    type: KnowledgeType
    context: ContextTags

    decision_rule: Optional[DecisionRule] = None
    rationale: Optional[str] = None
    exception: Optional[str] = None

    novelty_score: float = Field(
        ge=0.0,
        le=1.0,
    )

    confidence_score: float = Field(
        ge=0.0,
        le=1.0,
    )

    validation_status: ValidationStatus = (
        ValidationStatus.CANDIDATE
    )


class SynthesisRelation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    synthesized_index: int = Field(ge=0)
    target_knowledge_id: str
    relation: RelationType
    reason: str


class KnowledgeSynthesisResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operation: SynthesisOperation

    target_knowledge_ids: List[str] = Field(
        default_factory=list
    )

    synthesized_knowledge_units: List[
        SynthesizedKnowledgeUnit
    ] = Field(default_factory=list)

    relations: List[
        SynthesisRelation
    ] = Field(default_factory=list)

    reason: str