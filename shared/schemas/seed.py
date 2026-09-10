from typing import List, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
)

from .common import ContextTags
from .enums import KnowledgeType


class BaselineSource(BaseModel):
    model_config = ConfigDict(
        extra="forbid"
    )

    file_name: str
    page: int | None = None
    section: str | None = None


class BaselineClaimExtractionRequest(BaseModel):
    """
    Backend -> AI Baseline Claim Extraction v1.0 contract.

    Required:
    - schema_version
    - chunk_id
    - content
    - source
    - context

    ContextTags itself is required, while its individual scalar fields
    are optional and constraints/tags default to [].
    """
    model_config = ConfigDict(
        extra="forbid"
    )

    schema_version: Literal["1.0"]
    chunk_id: UUID
    content: str
    source: BaselineSource
    context: ContextTags


class BaselineClaim(BaseModel):
    model_config = ConfigDict(
        extra="forbid"
    )

    statement: str
    claim_type: KnowledgeType
    context: ContextTags

    source_chunk_id: UUID
    source_text: str

    confidence_score: float = Field(
        ge=0.0,
        le=1.0,
    )


class BaselineClaimExtractionResponse(BaseModel):
    """
    AI -> Backend Baseline Claim Extraction v1.0 contract.

    System-managed identifiers are echoed from the request by
    BaselineClaimExtractor after structured LLM generation.
    """
    model_config = ConfigDict(
        extra="forbid"
    )

    schema_version: Literal["1.0"]
    chunk_id: UUID

    claims: List[BaselineClaim] = Field(
        default_factory=list
    )
