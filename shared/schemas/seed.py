from typing import List

from pydantic import BaseModel, Field

from .common import ContextTags
from .enums import KnowledgeType


class BaselineClaimExtractionRequest(BaseModel):
    chunk_id: str
    content: str
    source: str
    context: ContextTags


class BaselineClaim(BaseModel):
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
    chunk_id: str

    claims: List[BaselineClaim] = Field(
        default_factory=list
    )