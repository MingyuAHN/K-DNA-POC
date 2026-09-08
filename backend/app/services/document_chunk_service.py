import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.document_chunk import DocumentChunk
from app.services.document_service import get_document
from app.services.text_chunker import chunk_text


def get_document_chunk(
    db: Session,
    chunk_id: uuid.UUID,
) -> DocumentChunk | None:

    return (
        db.query(DocumentChunk)
        .filter(DocumentChunk.chunk_id == chunk_id)
        .first()
    )


def get_document_chunks(
    db: Session,
    document_id: uuid.UUID,
) -> list[DocumentChunk]:

    return (
        db.query(DocumentChunk)
        .filter(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.seq.asc())
        .all()
    )


def chunk_document(
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

    if not document.raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document must be parsed before chunking",
        )

    try:
        document.processing_status = "CHUNKING"
        document.processing_error = None

        db.flush()

        chunks = chunk_text(
            text=document.raw_text,
            chunk_size=1000,
            overlap=150,
        )

        if not chunks:
            raise ValueError("No chunks were generated")

        # 같은 문서를 다시 Chunking할 경우
        # 기존 Chunk를 삭제하고 다시 생성
        (
            db.query(DocumentChunk)
            .filter(
                DocumentChunk.document_id == document_id
            )
            .delete(
                synchronize_session=False
            )
        )

        rows: list[DocumentChunk] = []

        for chunk in chunks:
            row = DocumentChunk(
                document_id=document_id,
                seq=chunk.seq,
                content=chunk.content,
                source_location={
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char,
                },
                token_count=None,
                metadata_={
                    "chunk_size": 1000,
                    "overlap": 150,
                },
            )

            db.add(row)
            rows.append(row)

        document.processing_status = "CHUNKED"

        db.commit()

        for row in rows:
            db.refresh(row)

        return {
            "document_id": str(document.document_id),
            "processing_status": document.processing_status,
            "chunk_count": len(rows),
            "chunks": [
                {
                    "chunk_id": str(row.chunk_id),
                    "seq": row.seq,
                    "content_preview": row.content[:150],
                }
                for row in rows
            ],
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
            detail=f"Document chunking failed: {str(exc)}",
        )