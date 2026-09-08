import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


ValidationStatus = Literal[
    "VERIFIED",
    "CONFLICTED",
    "INSUFFICIENT_EVIDENCE",
    "EXPERT_OPINION",
    "REJECTED",
]


class KnowledgeCandidateValidationRequest(
    BaseModel
):
    status: ValidationStatus

    reason: str | None = None

    validated_by: str | None = None


class EvidenceResponse(BaseModel):
    evidence_id: uuid.UUID

    source_type: str
    source_id: str

    source_text: str | None

    confidence_score: float | None

    model_config = ConfigDict(
        from_attributes=True
    )


class KnowledgeUnitResponse(BaseModel):
    knowledge_id: uuid.UUID
    mission_id: uuid.UUID

    source_candidate_id: uuid.UUID | None

    knowledge_type: str
    statement: str

    context: dict[str, Any]

    decision_rule: dict[str, Any] | None

    rationale: str | None
    exception: str | None

    status: str

    confidence_score: float | None

    version: int

    root_knowledge_id: uuid.UUID | None
    supersedes_id: uuid.UUID | None

    change_reason: str | None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class ValidationResponse(BaseModel):
    validation_id: uuid.UUID

    candidate_id: uuid.UUID

    knowledge_id: uuid.UUID | None

    status: str

    reason: str | None

    validated_by: str | None

    knowledge_unit: (
        KnowledgeUnitResponse | None
    ) = None


class KnowledgeUnitDetailResponse(
    KnowledgeUnitResponse
):
    evidence: list[EvidenceResponse]