import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.clients.ai_client import (
    AIClientError,
    ai_client,
)
from app.models.baseline_claim import BaselineClaim
from app.schemas.embedding import (
    DocumentEmbeddingResponse,
    EmbeddingItemRequest,
    EmbeddingRequest,
    EmbeddingResponse,
)
from app.services.document_chunk_service import (
    get_document_chunks,
)
from app.services.document_service import (
    get_document,
)


EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSION = 1536

# 너무 많은 데이터를 한 요청에 보내지 않기 위한
# PoC 기본 Batch 크기
EMBEDDING_BATCH_SIZE = 50


def validate_embedding_response(
    response: EmbeddingResponse,
) -> None:

    if response.model != EMBEDDING_MODEL:
        raise ValueError(
            "Unexpected embedding model: "
            f"{response.model}"
        )

    if response.dimension != EMBEDDING_DIMENSION:
        raise ValueError(
            "Unexpected embedding dimension: "
            f"{response.dimension}"
        )

    for embedding in response.embeddings:

        if len(embedding.vector) != EMBEDDING_DIMENSION:
            raise ValueError(
                "Embedding vector must contain "
                "exactly 1536 values"
            )


def generate_document_embeddings(
    db: Session,
    document_id: uuid.UUID,
) -> DocumentEmbeddingResponse:

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
                "embedding generation"
            ),
        )

    chunk_ids = [
        chunk.chunk_id
        for chunk in chunks
    ]

    claims = (
        db.query(BaselineClaim)
        .filter(
            BaselineClaim.source_chunk_id.in_(
                chunk_ids
            )
        )
        .order_by(
            BaselineClaim.created_at.asc()
        )
        .all()
    )

    try:
        # ------------------------------------
        # 1. 처리 상태 변경
        # ------------------------------------
        document.processing_status = "EMBEDDING"
        document.processing_error = None

        db.commit()

        # ------------------------------------
        # 2. AI 요청 Item 구성
        # ------------------------------------
        request_items: list[
            EmbeddingItemRequest
        ] = []

        for chunk in chunks:
            request_items.append(
                EmbeddingItemRequest(
                    item_id=chunk.chunk_id,
                    item_type="CHUNK",
                    text=chunk.content,
                )
            )

        for claim in claims:
            request_items.append(
                EmbeddingItemRequest(
                    item_id=claim.claim_id,
                    item_type="BASELINE_CLAIM",
                    text=claim.statement,
                )
            )

        # ------------------------------------
        # 3. AI Embedding API 호출
        #
        # DB에는 아직 저장하지 않고
        # 모든 Batch 호출이 성공한 뒤 저장
        # ------------------------------------
        embedding_map: dict[
            tuple[str, uuid.UUID],
            list[float],
        ] = {}

        for start in range(
            0,
            len(request_items),
            EMBEDDING_BATCH_SIZE,
        ):
            batch_items = request_items[
                start:
                start + EMBEDDING_BATCH_SIZE
            ]

            request = EmbeddingRequest(
                items=batch_items
            )

            response = ai_client.create_embeddings(
                request=request
            )

            validate_embedding_response(
                response=response
            )

            for result in response.embeddings:

                key = (
                    result.item_type,
                    result.item_id,
                )

                if key in embedding_map:
                    raise ValueError(
                        "Duplicate embedding returned "
                        f"for {result.item_type} "
                        f"{result.item_id}"
                    )

                embedding_map[key] = result.vector

        # ------------------------------------
        # 4. 요청한 모든 Item이 반환됐는지 확인
        # ------------------------------------
        expected_keys = {
            (
                item.item_type,
                item.item_id,
            )
            for item in request_items
        }

        returned_keys = set(
            embedding_map.keys()
        )

        missing_keys = (
            expected_keys - returned_keys
        )

        unexpected_keys = (
            returned_keys - expected_keys
        )

        if missing_keys:
            raise ValueError(
                "AI embedding response is missing "
                f"{len(missing_keys)} item(s)"
            )

        if unexpected_keys:
            raise ValueError(
                "AI embedding response contains "
                f"{len(unexpected_keys)} unexpected item(s)"
            )

        # ------------------------------------
        # 5. Chunk Embedding 저장
        # ------------------------------------
        for chunk in chunks:

            key = (
                "CHUNK",
                chunk.chunk_id,
            )

            chunk.embedding = (
                embedding_map[key]
            )

        # ------------------------------------
        # 6. Baseline Claim Embedding 저장
        # ------------------------------------
        for claim in claims:

            key = (
                "BASELINE_CLAIM",
                claim.claim_id,
            )

            claim.embedding = (
                embedding_map[key]
            )

        # ------------------------------------
        # 7. 전체 처리 완료
        # ------------------------------------
        document.processing_status = "COMPLETED"
        document.processing_error = None

        db.commit()

        return DocumentEmbeddingResponse(
            document_id=document.document_id,
            processing_status=(
                document.processing_status
            ),
            model=EMBEDDING_MODEL,
            dimension=EMBEDDING_DIMENSION,
            chunk_total=len(chunks),
            chunk_embedded=len(chunks),
            baseline_claim_total=len(claims),
            baseline_claim_embedded=len(claims),
        )

    except AIClientError as exc:
        db.rollback()

        failed_document = get_document(
            db=db,
            document_id=document_id,
        )

        if failed_document:
            failed_document.processing_status = (
                "FAILED"
            )
            failed_document.processing_error = (
                str(exc)
            )

            db.commit()

        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "AI embedding service error: "
                f"{str(exc)}"
            ),
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
            failed_document.processing_status = (
                "FAILED"
            )
            failed_document.processing_error = (
                str(exc)
            )

            db.commit()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Embedding generation failed: "
                f"{str(exc)}"
            ),
        )