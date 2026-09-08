import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.embedding import (
    DocumentEmbeddingResponse,
)
from app.services.embedding_service import (
    generate_document_embeddings,
)


router = APIRouter(
    prefix="/api/v1",
    tags=["embeddings"],
)


@router.post(
    "/documents/{document_id}/embeddings/generate",
    response_model=DocumentEmbeddingResponse,
)
def generate_document_embeddings_api(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    return generate_document_embeddings(
        db=db,
        document_id=document_id,
    )