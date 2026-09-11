import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ContextTags(BaseModel):
    model_config = ConfigDict(extra="forbid")

    domain: str | None = None
    project: str | None = None
    phase: str | None = None
    system: str | None = None
    scope: str | None = None
    time: str | None = None

    constraints: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class BaselineSource(BaseModel):
    model_config = ConfigDict(extra="forbid")

    file_name: str
    page: int | None = None
    section: str | None = None


class BaselineClaimExtractionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1.0"]
    chunk_id: uuid.UUID
    content: str
    source: BaselineSource
    context: ContextTags


class ExtractedClaim(BaseModel):
    statement: str
    claim_type: str

    context: dict[str, Any] = Field(
        default_factory=dict
    )

    source_chunk_id: uuid.UUID
    source_text: str | None = None

    confidence_score: float | None = Field(
        default=None,
        ge=0,
        le=1,
    )


class BaselineClaimExtractionResponse(BaseModel):
    schema_version: Literal["1.0"]

    chunk_id: uuid.UUID
    claims: list[ExtractedClaim]


class SavedBaselineClaim(BaseModel):
    claim_id: uuid.UUID
    mission_id: uuid.UUID
    source_chunk_id: uuid.UUID

    claim_type: str
    statement: str

    context: dict[str, Any]

    source_text: str | None
    confidence_score: float | None


class BaselineClaimSaveResponse(BaseModel):
    schema_version: str = "1.0"

    chunk_id: uuid.UUID
    saved_count: int

    claims: list[SavedBaselineClaim]


class DocumentClaimExtractionResponse(BaseModel):
    schema_version: str = "1.0"

    document_id: uuid.UUID
    processing_status: str

    chunk_count: int
    extracted_claim_count: int

    claims: list[SavedBaselineClaim]


# Transitional aliases for existing backend imports.
# New code should use BaselineSource / ContextTags.
ClaimSource = BaselineSource
ClaimExtractionContext = ContextTags
