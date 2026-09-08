from typing import List

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
)

from .common import ContextTags
from .enums import KnowledgeType


class BaselineClaimExtractionRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid"
    )

    chunk_id: str
    content: str
    source: str
    context: ContextTags
class BaselineClaim(BaseModel):
    model_config = ConfigDict(
        extra="forbid"
    )

    statement: str
    claim_type: KnowledgeType
    context: ContextTags

    source_chunk_id: str
    source_text: str

    confidence_score: float = Field(
        ge=0.0,
        le=1.0,
    )


class BaselineClaimExtractionResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid"
    )

    chunk_id: str

    claims: List[BaselineClaim] = Field(
        default_factory=list
    )