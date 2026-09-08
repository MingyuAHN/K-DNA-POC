import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.supabase import supabase
from app.models.document import Document
from app.services.mission_service import get_mission


STORAGE_BUCKET = "seed-documents"

ALLOWED_EXTENSIONS = {
    ".pdf": "PDF",
    ".docx": "DOCX",
    ".txt": "TXT",
    ".md": "MD",
}


def upload_document(
    db: Session,
    mission_id: uuid.UUID,
    file: UploadFile,
) -> Document:

    # 1. Mission 존재 확인
    mission = get_mission(db, mission_id)

    if mission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )

    # 2. 파일명 확인
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File name is required",
        )

    extension = Path(file.filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Allowed: PDF, DOCX, TXT, MD",
        )

    # 3. 파일 읽기
    file_bytes = file.file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file is not allowed",
        )

    # 4. document_id 선생성
    document_id = uuid.uuid4()

    # Storage 경로
    storage_path = (
        f"{mission_id}/"
        f"{document_id}/"
        f"{file.filename}"
    )

    try:
        # 5. Supabase Storage 업로드
        supabase.storage.from_(STORAGE_BUCKET).upload(
            path=storage_path,
            file=file_bytes,
            file_options={
                "content-type": file.content_type
                or "application/octet-stream"
            },
        )

        # 6. Document DB 저장
        document = Document(
            document_id=document_id,
            mission_id=mission_id,
            file_name=file.filename,
            document_type=ALLOWED_EXTENSIONS[extension],
            content_uri=f"{STORAGE_BUCKET}/{storage_path}",
            processing_status="UPLOADED",
            metadata_={
                "content_type": file.content_type,
                "size": len(file_bytes),
            },
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        return document

    except HTTPException:
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document upload failed: {str(exc)}",
        )

def get_document(
    db: Session,
    document_id: uuid.UUID,
) -> Document | None:

    return (
        db.query(Document)
        .filter(Document.document_id == document_id)
        .first()
    )