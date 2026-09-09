from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from .enums import (
    ValidationStatus,
    HumanReviewAction,
)

from .interview import RetrievedEvidence

from .synthesis import (
    SynthesizedKnowledgeUnit,
    ExistingKnowledgeUnit,
)


class ValidationMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    evidence_support: float = Field(ge=0.0, le=1.0)
    source_independence: float = Field(ge=0.0, le=1.0)
    cross_expert_agreement: float = Field(ge=0.0, le=1.0)
    context_completeness: float = Field(ge=0.0, le=1.0)
    exception_completeness: float = Field(ge=0.0, le=1.0)
    outcome_evidence: float = Field(ge=0.0, le=1.0)
    recency: float = Field(ge=0.0, le=1.0)


class KnowledgeValidationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    knowledge_unit: SynthesizedKnowledgeUnit

    evidence: List[RetrievedEvidence] = Field(
        default_factory=list
    )

    related_knowledge: List[ExistingKnowledgeUnit] = Field(
        default_factory=list
    )

    expert_confirmed: Optional[bool] = None


class KnowledgeValidationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    validation_status: ValidationStatus

    metrics: ValidationMetrics

    overall_score: float = Field(
        ge=0.0,
        le=1.0,
    )

    evidence_source_ids: List[str] = Field(
        default_factory=list
    )

    missing_requirements: List[str] = Field(
        default_factory=list
    )

    recommended_action: HumanReviewAction

    reason: str