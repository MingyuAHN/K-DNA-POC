import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.supabase import supabase
from app.models.document import Document
from app.services.document_parser import parse_document_bytes
from app.services.document_service import get_document


def parse_document(
    db: Session,
    document_id: uuid.UUID,
) -> dict:

    document = get_document(
        db=db,
        document_id=document_id,
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if not document.content_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document content_uri is missing",
        )

    if not document.document_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document type is missing",
        )

    try:
        # 1. 상태 변경
        document.processing_status = "PARSING"
        document.processing_error = None
        db.commit()

        # content_uri 예:
        # seed-documents/{mission_id}/{document_id}/test.txt

        bucket_name, storage_path = (
            document.content_uri.split("/", 1)
        )

        # 2. Supabase Storage에서 원본 파일 다운로드
        file_bytes = (
            supabase.storage
            .from_(bucket_name)
            .download(storage_path)
        )

        # 3. 파일 파싱
        raw_text = parse_document_bytes(
            file_bytes=file_bytes,
            document_type=document.document_type,
        )

        if not raw_text.strip():
            raise ValueError(
                "No text could be extracted from document"
            )

        # 4. DB 저장
        document.raw_text = raw_text
        document.processing_status = "PARSED"
        document.processing_error = None

        db.commit()
        db.refresh(document)

        return {
            "document_id": str(document.document_id),
            "processing_status": document.processing_status,
            "raw_text_length": len(raw_text),
            "raw_text_preview": raw_text[:300],
        }

    except HTTPException:
        raise

    except Exception as exc:
        db.rollback()

        failed_document = get_document(
            db=db,
            document_id=document_id,
        )

        if failed_document:
            failed_document.processing_status = "FAILED"
            failed_document.processing_error = str(exc)
            db.commit()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document parsing failed: {str(exc)}",
        )