import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.clients.ai_client import (
    AIClientError,
    ai_client,
)
from app.models.baseline_claim import BaselineClaim
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.mission import Mission
from app.schemas.baseline_claim import (
    BaselineClaimExtractionRequest,
    BaselineClaimExtractionResponse,
    BaselineSource,
    ContextTags,
)
from app.services.document_chunk_service import (
    get_document_chunk,
    get_document_chunks,
)
from app.services.document_service import get_document


ALLOWED_CLAIM_TYPES = {
    "PRINCIPLE",
    "DECISION",
    "EXCEPTION",
    "OUTCOME",
}


def _build_request(
    chunk: DocumentChunk,
    document: Document,
    mission: Mission,
) -> BaselineClaimExtractionRequest:
    """
    Baseline Claim Extraction v1.0 Contract를 한 곳에서 조립한다.

    Mission에는 현재 domain/objective가 있지만, v1.0 ContextTags에는
    objective가 포함되지 않는다. 따라서 domain만 전달하고 나머지
    ContextTags 필드는 null / [] 기본값을 사용한다.
    """

    return BaselineClaimExtractionRequest(
        schema_version="1.0",
        chunk_id=chunk.chunk_id,
        content=chunk.content,
        source=BaselineSource(
            file_name=document.file_name,
            page=chunk.page_number,
            section=chunk.section,
        ),
        context=ContextTags(
            domain=mission.domain,
        ),
    )


def build_claim_extraction_request(
    db: Session,
    chunk_id: uuid.UUID,
) -> BaselineClaimExtractionRequest:
    chunk = get_document_chunk(
        db=db,
        chunk_id=chunk_id,
    )

    if chunk is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document chunk not found",
        )

    document = (
        db.query(Document)
        .filter(
            Document.document_id
            == chunk.document_id
        )
        .first()
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    mission = (
        db.query(Mission)
        .filter(
            Mission.mission_id
            == document.mission_id
        )
        .first()
    )

    if mission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )

    return _build_request(
        chunk=chunk,
        document=document,
        mission=mission,
    )


def validate_ai_result(
    chunk: DocumentChunk,
    result: BaselineClaimExtractionResponse,
) -> None:
    if result.chunk_id != chunk.chunk_id:
        raise ValueError(
            "AI response chunk_id does not match "
            "requested chunk_id"
        )

    for claim in result.claims:
        if claim.claim_type not in ALLOWED_CLAIM_TYPES:
            raise ValueError(
                "Unsupported claim type: "
                f"{claim.claim_type}"
            )

        if claim.source_chunk_id != chunk.chunk_id:
            raise ValueError(
                "AI response source_chunk_id does not "
                "match requested chunk_id"
            )

        if not claim.statement.strip():
            raise ValueError(
                "AI returned empty claim statement"
            )


def save_extracted_claims(
    db: Session,
    result: BaselineClaimExtractionResponse,
) -> list[BaselineClaim]:
    chunk = get_document_chunk(
        db=db,
        chunk_id=result.chunk_id,
    )

    if chunk is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source chunk not found",
        )

    document = get_document(
        db=db,
        document_id=chunk.document_id,
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    try:
        validate_ai_result(
            chunk=chunk,
            result=result,
        )

        (
            db.query(BaselineClaim)
            .filter(
                BaselineClaim.source_chunk_id
                == result.chunk_id
            )
            .delete(
                synchronize_session=False
            )
        )

        saved_claims: list[BaselineClaim] = []

        for claim in result.claims:
            row = BaselineClaim(
                mission_id=document.mission_id,
                source_chunk_id=claim.source_chunk_id,
                claim_type=claim.claim_type,
                statement=claim.statement,
                context=claim.context,
                source_text=claim.source_text,
                confidence_score=claim.confidence_score,
            )

            db.add(row)
            saved_claims.append(row)

        db.commit()

        for row in saved_claims:
            db.refresh(row)

        return saved_claims

    except HTTPException:
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Baseline claim save failed: "
                f"{str(exc)}"
            ),
        )


def extract_document_claims(
    db: Session,
    document_id: uuid.UUID,
) -> list[BaselineClaim]:
    document = get_document(
        db=db,
        document_id=document_id,
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    chunks = get_document_chunks(
        db=db,
        document_id=document_id,
    )

    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Document must be chunked before "
                "claim extraction"
            ),
        )

    mission = (
        db.query(Mission)
        .filter(
            Mission.mission_id
            == document.mission_id
        )
        .first()
    )

    if mission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )

    try:
        # 1. 처리 상태 변경
        document.processing_status = "CLAIM_EXTRACTING"
        document.processing_error = None
        db.commit()

        # 2. 모든 Chunk의 AI 결과를 먼저 수집한다.
        #    중간 실패 시 일부 Claim만 저장되는 것을 방지한다.
        extraction_results: list[
            BaselineClaimExtractionResponse
        ] = []

        for chunk in chunks:
            request = _build_request(
                chunk=chunk,
                document=document,
                mission=mission,
            )

            result = (
                ai_client.extract_baseline_claims(
                    request=request
                )
            )

            validate_ai_result(
                chunk=chunk,
                result=result,
            )

            extraction_results.append(result)

        # 3. AI 호출이 전부 성공한 뒤 기존 Claim을 한 번에 제거한다.
        chunk_ids = [
            chunk.chunk_id
            for chunk in chunks
        ]

        (
            db.query(BaselineClaim)
            .filter(
                BaselineClaim.source_chunk_id.in_(
                    chunk_ids
                )
            )
            .delete(
                synchronize_session=False
            )
        )

        # 4. 새로운 Claim 전체 저장
        saved_claims: list[BaselineClaim] = []

        for result in extraction_results:
            for claim in result.claims:
                row = BaselineClaim(
                    mission_id=document.mission_id,
                    source_chunk_id=claim.source_chunk_id,
                    claim_type=claim.claim_type,
                    statement=claim.statement,
                    context=claim.context,
                    source_text=claim.source_text,
                    confidence_score=claim.confidence_score,
                )

                db.add(row)
                saved_claims.append(row)

        document.processing_status = "CLAIMS_EXTRACTED"
        document.processing_error = None

        db.commit()

        for row in saved_claims:
            db.refresh(row)

        return saved_claims

    except AIClientError as exc:
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
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service error: {str(exc)}",
        )

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
            detail=(
                "Baseline claim extraction failed: "
                f"{str(exc)}"
            ),
        )
