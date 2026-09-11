import uuid
from typing import Literal

from pydantic import BaseModel, Field


SynthesisDecision = Literal[
    "APPROVE",
    "REJECT",
]


class KnowledgeSynthesisValidationRequest(
    BaseModel
):
    decision: SynthesisDecision

    reason: str = Field(
        min_length=1,
        max_length=2000,
    )

    validated_by: str = Field(
        min_length=1,
        max_length=200,
    )


class AppliedKnowledgeUnit(BaseModel):
    synthesis_unit_id: uuid.UUID
    knowledge_id: uuid.UUID

    knowledge_type: str
    statement: str

    version: int
    status: str


class KnowledgeSynthesisValidationResponse(
    BaseModel
):
    synthesis_id: uuid.UUID

    decision: SynthesisDecision
    status: str

    operation: str

    resulting_knowledge_ids: list[
        uuid.UUID
    ] = Field(default_factory=list)

    knowledge_units: list[
        AppliedKnowledgeUnit
    ] = Field(default_factory=list)

    reason: str | None = None
    validated_by: str | None = None