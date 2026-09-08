import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.retrieval import (
    RetrievalSearchRequest,
    RetrievalSearchResponse,
    RetrievalStatusResponse,
    RetrievalTextSearchRequest,
)
from app.services.retrieval_service import (
    get_retrieval_status,
    search_retrieval,
    search_retrieval_by_text,
)


router = APIRouter(
    prefix="/api/v1/retrieval",
    tags=["retrieval"],
)


@router.post(
    "/search",
    response_model=RetrievalSearchResponse,
)
def retrieval_search_api(
    request: RetrievalSearchRequest,
    db: Session = Depends(get_db),
):
    return search_retrieval(
        db=db,
        request=request,
    )


@router.post(
    "/search-text",
    response_model=RetrievalSearchResponse,
)
def retrieval_text_search_api(
    request: RetrievalTextSearchRequest,
    db: Session = Depends(get_db),
):
    return search_retrieval_by_text(
        db=db,
        request=request,
    )


@router.get(
    "/missions/{mission_id}/status",
    response_model=RetrievalStatusResponse,
)
def retrieval_status_api(
    mission_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    return get_retrieval_status(
        db=db,
        mission_id=mission_id,
    )