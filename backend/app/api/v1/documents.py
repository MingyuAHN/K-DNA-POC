import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.document import DocumentResponse
from app.services.document_service import upload_document


router = APIRouter(
    prefix="/api/v1/missions",
    tags=["documents"],
)


@router.post(
    "/{mission_id}/documents",
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