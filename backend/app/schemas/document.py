import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    document_id: uuid.UUID
    mission_id: uuid.UUID
    file_name: str
    document_type: str | None
    content_uri: str | None
    processing_status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DocumentParseResponse(BaseModel):
    document_id: uuid.UUID
    processing_status: str
    raw_text_length: int
    raw_text_preview: str

class ChunkSummary(BaseModel):
    chunk_id: uuid.UUID
    seq: int
    content_preview: str


class DocumentChunkResponse(BaseModel):
    document_id: uuid.UUID
    processing_status: str
    chunk_count: int
    chunks: list[ChunkSummary]