import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.document import (
    DocumentParseResponse,
    DocumentResponse,
)
from app.services.document_processing_service import parse_document
from app.services.document_service import upload_document
from app.schemas.document import (
    DocumentResponse,
    DocumentParseResponse,
    DocumentChunkResponse,
)

from app.services.document_chunk_service import chunk_document

router = APIRouter(
    prefix="/api/v1",
    tags=["documents"],
)


@router.post(
    "/missions/{mission_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_document_api(
    mission_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return upload_document(
        db=db,
        mission_id=mission_id,
        file=file,
    )


@router.post(
    "/documents/{document_id}/parse",
    response_model=DocumentParseResponse,
)
def parse_document_api(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    return parse_document(
        db=db,
        document_id=document_id,
    )

@router.post(
    "/documents/{document_id}/chunk",
    response_model=DocumentChunkResponse,
)
def chunk_document_api(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    return chunk_document(
        db=db,
        document_id=document_id,
    )