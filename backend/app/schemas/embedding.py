import uuid
from typing import Literal

from pydantic import BaseModel, Field


EmbeddingItemType = Literal[
    "CHUNK",
    "BASELINE_CLAIM",
    "QUERY",
]


class EmbeddingItemRequest(BaseModel):
    item_id: uuid.UUID
    item_type: EmbeddingItemType
    text: str


class EmbeddingRequest(BaseModel):
    items: list[EmbeddingItemRequest]


class EmbeddingResult(BaseModel):
    item_id: uuid.UUID
    item_type: EmbeddingItemType

    vector: list[float] = Field(
        ...,
        min_length=1536,
        max_length=1536,
    )


class EmbeddingResponse(BaseModel):
    model: str
    dimension: int
    embeddings: list[EmbeddingResult]


class DocumentEmbeddingResponse(BaseModel):
    document_id: uuid.UUID

    processing_status: str

    model: str
    dimension: int

    chunk_total: int
    chunk_embedded: int

    baseline_claim_total: int
    baseline_claim_embedded: int