import uuid
from typing import Literal

from pydantic import BaseModel, Field


RetrievalTarget = Literal[
    "BASELINE_CLAIM",
    "DOCUMENT_CHUNK",
]


class RetrievalSearchRequest(BaseModel):
    mission_id: uuid.UUID

    target: RetrievalTarget = "BASELINE_CLAIM"

    query_vector: list[float] = Field(
        ...,
        min_length=1536,
        max_length=1536,
    )

    top_k: int = Field(
        default=5,
        ge=1,
        le=50,
    )


class RetrievalTextSearchRequest(BaseModel):
    mission_id: uuid.UUID

    query_text: str = Field(
        ...,
        min_length=1,
    )

    target: RetrievalTarget = "BASELINE_CLAIM"

    top_k: int = Field(
        default=5,
        ge=1,
        le=50,
    )


class RetrievalResultItem(BaseModel):
    id: uuid.UUID

    target: RetrievalTarget

    text: str

    similarity: float
    cosine_distance: float

    document_id: uuid.UUID | None = None
    source_chunk_id: uuid.UUID | None = None

    file_name: str | None = None
    page: int | None = None
    section: str | None = None

    claim_type: str | None = None


class RetrievalSearchResponse(BaseModel):
    mission_id: uuid.UUID

    target: RetrievalTarget

    top_k: int

    result_count: int

    results: list[RetrievalResultItem]


class RetrievalStatusResponse(BaseModel):
    mission_id: uuid.UUID

    baseline_claim_total: int
    baseline_claim_embedded: int

    document_chunk_total: int
    document_chunk_embedded: int