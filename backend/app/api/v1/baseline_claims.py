import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.baseline_claim import (
    BaselineClaimExtractionRequest,
    BaselineClaimExtractionResponse,
    BaselineClaimSaveResponse,
    DocumentClaimExtractionResponse,
    SavedBaselineClaim,
)
from app.services.baseline_claim_service import (
    build_claim_extraction_request,
    extract_document_claims,
    save_extracted_claims,
)
from app.services.document_chunk_service import (
    get_document_chunks,
)


router = APIRouter(
    prefix="/api/v1",
    tags=["baseline-claims"],
)


@router.get(
    "/chunks/{chunk_id}/claim-extraction-input",
    response_model=BaselineClaimExtractionRequest,
)
def get_claim_extraction_input(
    chunk_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    return build_claim_extraction_request(
        db=db,
        chunk_id=chunk_id,
    )


@router.post(
    "/baseline-claims/extraction-result",
    response_model=BaselineClaimSaveResponse,
)
def save_claim_extraction_result(
    request: BaselineClaimExtractionResponse,
    db: Session = Depends(get_db),
):
    rows = save_extracted_claims(
        db=db,
        result=request,
    )

    return BaselineClaimSaveResponse(
        chunk_id=request.chunk_id,
        saved_count=len(rows),
        claims=[
            SavedBaselineClaim(
                claim_id=row.claim_id,
                mission_id=row.mission_id,
                source_chunk_id=row.source_chunk_id,
                claim_type=row.claim_type,
                statement=row.statement,
                context=row.context,
                source_text=row.source_text,
                confidence_score=(
                    float(row.confidence_score)
                    if row.confidence_score
                    is not None
                    else None
                ),
            )
            for row in rows
        ],
    )


@router.post(
    "/documents/{document_id}/claims/extract",
    response_model=DocumentClaimExtractionResponse,
)
def extract_document_claims_api(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    rows = extract_document_claims(
        db=db,
        document_id=document_id,
    )

    chunks = get_document_chunks(
        db=db,
        document_id=document_id,
    )

    return DocumentClaimExtractionResponse(
        document_id=document_id,
        processing_status="CLAIMS_EXTRACTED",
        chunk_count=len(chunks),
        extracted_claim_count=len(rows),
        claims=[
            SavedBaselineClaim(
                claim_id=row.claim_id,
                mission_id=row.mission_id,
                source_chunk_id=row.source_chunk_id,
                claim_type=row.claim_type,
                statement=row.statement,
                context=row.context,
                source_text=row.source_text,
                confidence_score=(
                    float(row.confidence_score)
                    if row.confidence_score
                    is not None
                    else None
                ),
            )
            for row in rows
        ],
    )