import uuid

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.clients.ai_client import (
    AIClientError,
    ai_client,
)
from app.models.baseline_claim import BaselineClaim
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.schemas.embedding import (
    EmbeddingItemRequest,
    EmbeddingRequest,
)
from app.schemas.retrieval import (
    RetrievalResultItem,
    RetrievalSearchRequest,
    RetrievalSearchResponse,
    RetrievalStatusResponse,
    RetrievalTextSearchRequest,
)
from app.services.mission_service import get_mission


EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSION = 1536


def search_baseline_claims(
    db: Session,
    mission_id: uuid.UUID,
    query_vector: list[float],
    top_k: int,
) -> list[RetrievalResultItem]:

    cosine_distance = (
        BaselineClaim.embedding.cosine_distance(
            query_vector
        )
    )

    rows = (
        db.query(
            BaselineClaim,
            DocumentChunk,
            Document,
            cosine_distance.label(
                "cosine_distance"
            ),
        )
        .join(
            DocumentChunk,
            DocumentChunk.chunk_id
            == BaselineClaim.source_chunk_id,
        )
        .join(
            Document,
            Document.document_id
            == DocumentChunk.document_id,
        )
        .filter(
            BaselineClaim.mission_id
            == mission_id,
            BaselineClaim.embedding.isnot(None),
        )
        .order_by(
            cosine_distance.asc()
        )
        .limit(top_k)
        .all()
    )

    results: list[RetrievalResultItem] = []

    for claim, chunk, document, distance in rows:
        distance_value = float(distance)

        results.append(
            RetrievalResultItem(
                id=claim.claim_id,
                target="BASELINE_CLAIM",
                text=claim.statement,
                similarity=1.0 - distance_value,
                cosine_distance=distance_value,
                document_id=document.document_id,
                source_chunk_id=chunk.chunk_id,
                file_name=document.file_name,
                page=chunk.page_number,
                section=chunk.section,
                claim_type=claim.claim_type,
            )
        )

    return results


def search_document_chunks(
    db: Session,
    mission_id: uuid.UUID,
    query_vector: list[float],
    top_k: int,
) -> list[RetrievalResultItem]:

    cosine_distance = (
        DocumentChunk.embedding.cosine_distance(
            query_vector
        )
    )

    rows = (
        db.query(
            DocumentChunk,
            Document,
            cosine_distance.label(
                "cosine_distance"
            ),
        )
        .join(
            Document,
            Document.document_id
            == DocumentChunk.document_id,
        )
        .filter(
            Document.mission_id == mission_id,
            DocumentChunk.embedding.isnot(None),
        )
        .order_by(
            cosine_distance.asc()
        )
        .limit(top_k)
        .all()
    )

    results: list[RetrievalResultItem] = []

    for chunk, document, distance in rows:
        distance_value = float(distance)

        results.append(
            RetrievalResultItem(
                id=chunk.chunk_id,
                target="DOCUMENT_CHUNK",
                text=chunk.content,
                similarity=1.0 - distance_value,
                cosine_distance=distance_value,
                document_id=document.document_id,
                source_chunk_id=chunk.chunk_id,
                file_name=document.file_name,
                page=chunk.page_number,
                section=chunk.section,
                claim_type=None,
            )
        )

    return results


def search_retrieval(
    db: Session,
    request: RetrievalSearchRequest,
) -> RetrievalSearchResponse:

    mission = get_mission(
        db=db,
        mission_id=request.mission_id,
    )

    if mission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )

    if len(request.query_vector) != 1536:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "query_vector must contain "
                "exactly 1536 dimensions"
            ),
        )

    if request.target == "BASELINE_CLAIM":

        results = search_baseline_claims(
            db=db,
            mission_id=request.mission_id,
            query_vector=request.query_vector,
            top_k=request.top_k,
        )

    elif request.target == "DOCUMENT_CHUNK":

        results = search_document_chunks(
            db=db,
            mission_id=request.mission_id,
            query_vector=request.query_vector,
            top_k=request.top_k,
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported retrieval target",
        )

    return RetrievalSearchResponse(
        mission_id=request.mission_id,
        target=request.target,
        top_k=request.top_k,
        result_count=len(results),
        results=results,
    )


def create_query_embedding(
    query_text: str,
) -> list[float]:

    query_id = uuid.uuid4()

    request = EmbeddingRequest(
        items=[
            EmbeddingItemRequest(
                item_id=query_id,
                item_type="QUERY",
                text=query_text,
            )
        ]
    )

    try:
        response = ai_client.create_embeddings(
            request=request
        )

    except AIClientError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "AI embedding service error: "
                f"{str(exc)}"
            ),
        )

    if response.model != EMBEDDING_MODEL:
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "Unexpected embedding model: "
                f"{response.model}"
            ),
        )

    if response.dimension != EMBEDDING_DIMENSION:
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "Unexpected embedding dimension: "
                f"{response.dimension}"
            ),
        )

    if len(response.embeddings) != 1:
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "AI embedding service must return "
                "exactly one QUERY embedding"
            ),
        )

    result = response.embeddings[0]

    if result.item_id != query_id:
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "Embedding response item_id "
                "does not match request"
            ),
        )

    if result.item_type != "QUERY":
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "Embedding response item_type "
                "must be QUERY"
            ),
        )

    if len(result.vector) != EMBEDDING_DIMENSION:
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "QUERY embedding vector must "
                "contain exactly 1536 values"
            ),
        )

    return result.vector


def search_retrieval_by_text(
    db: Session,
    request: RetrievalTextSearchRequest,
) -> RetrievalSearchResponse:

    mission = get_mission(
        db=db,
        mission_id=request.mission_id,
    )

    if mission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )

    query_text = request.query_text.strip()

    if not query_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="query_text is required",
        )

    query_vector = create_query_embedding(
        query_text=query_text,
    )

    vector_request = RetrievalSearchRequest(
        mission_id=request.mission_id,
        target=request.target,
        query_vector=query_vector,
        top_k=request.top_k,
    )

    return search_retrieval(
        db=db,
        request=vector_request,
    )


def get_retrieval_status(
    db: Session,
    mission_id: uuid.UUID,
) -> RetrievalStatusResponse:

    mission = get_mission(
        db=db,
        mission_id=mission_id,
    )

    if mission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )

    baseline_claim_total = (
        db.query(
            func.count(
                BaselineClaim.claim_id
            )
        )
        .filter(
            BaselineClaim.mission_id
            == mission_id
        )
        .scalar()
        or 0
    )

    baseline_claim_embedded = (
        db.query(
            func.count(
                BaselineClaim.claim_id
            )
        )
        .filter(
            BaselineClaim.mission_id
            == mission_id,
            BaselineClaim.embedding.isnot(None),
        )
        .scalar()
        or 0
    )

    document_chunk_total = (
        db.query(
            func.count(
                DocumentChunk.chunk_id
            )
        )
        .join(
            Document,
            Document.document_id
            == DocumentChunk.document_id,
        )
        .filter(
            Document.mission_id
            == mission_id
        )
        .scalar()
        or 0
    )

    document_chunk_embedded = (
        db.query(
            func.count(
                DocumentChunk.chunk_id
            )
        )
        .join(
            Document,
            Document.document_id
            == DocumentChunk.document_id,
        )
        .filter(
            Document.mission_id
            == mission_id,
            DocumentChunk.embedding.isnot(None),
        )
        .scalar()
        or 0
    )

    return RetrievalStatusResponse(
        mission_id=mission_id,
        baseline_claim_total=int(
            baseline_claim_total
        ),
        baseline_claim_embedded=int(
            baseline_claim_embedded
        ),
        document_chunk_total=int(
            document_chunk_total
        ),
        document_chunk_embedded=int(
            document_chunk_embedded
        ),
    )