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
    ClaimExtractionContext,
    ClaimSource,
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

    return BaselineClaimExtractionRequest(
        chunk_id=chunk.chunk_id,
        content=chunk.content,
        source=ClaimSource(
            file_name=document.file_name,
            page=chunk.page_number,
            section=chunk.section,
        ),
        context=ClaimExtractionContext(
            domain=mission.domain,
            objective=mission.objective,
        ),
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
        # ----------------------------------------
        # 1. 처리 상태 변경
        # ----------------------------------------
        document.processing_status = (
            "CLAIM_EXTRACTING"
        )
        document.processing_error = None

        db.commit()

        # ----------------------------------------
        # 2. 먼저 모든 Chunk에 대해 AI 호출
        #
        # DB 저장 전에 모든 AI 결과를 받아놓는다.
        # 중간 실패 시 일부 Claim만 저장되는 것을
        # 최대한 방지하기 위한 구조.
        # ----------------------------------------
        extraction_results: list[
            BaselineClaimExtractionResponse
        ] = []

        for chunk in chunks:

            request = BaselineClaimExtractionRequest(
                chunk_id=chunk.chunk_id,
                content=chunk.content,
                source=ClaimSource(
                    file_name=document.file_name,
                    page=chunk.page_number,
                    section=chunk.section,
                ),
                context=ClaimExtractionContext(
                    domain=mission.domain,
                    objective=mission.objective,
                ),
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

        # ----------------------------------------
        # 3. AI 호출이 전부 성공한 뒤
        # 기존 Claim을 한 번에 제거
        # ----------------------------------------
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

        # ----------------------------------------
        # 4. 새로운 Claim 전체 저장
        # ----------------------------------------
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

        document.processing_status = (
            "CLAIMS_EXTRACTED"
        )
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