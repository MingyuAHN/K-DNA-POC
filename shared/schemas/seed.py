from typing import List
from pydantic import BaseModel, Field

from .common import ContextTags
from .enums import KnowledgeType


class SeedChunkInput(BaseModel):
    chunk_id: str
    content: str
    source: str
    context: ContextTags


class BaselineClaim(BaseModel):
    statement: str
    type: KnowledgeType
    context: ContextTags

    source_chunk_id: str
    source_text: str

    confidence: float = Field(ge=0.0, le=1.0)


class BaselineClaimExtractionRequest(BaseModel):
    chunk: SeedChunkInput


class BaselineClaimExtractionResponse(BaseModel):
    claims: List[BaselineClaim] = Field(default_factory=list)