from enum import Enum
from typing import List

from pydantic import BaseModel, ConfigDict, Field


class EmbeddingItemType(str, Enum):
    CHUNK = "CHUNK"
    BASELINE_CLAIM = "BASELINE_CLAIM"
    QUERY = "QUERY"

class EmbeddingItemRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_id: str
    item_type: EmbeddingItemType
    text: str = Field(min_length=1)


class EmbeddingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: List[EmbeddingItemRequest] = Field(
        min_length=1
    )


class EmbeddingResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_id: str
    item_type: EmbeddingItemType
    vector: List[float]


class EmbeddingResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str
    dimension: int
    embeddings: List[EmbeddingResult]