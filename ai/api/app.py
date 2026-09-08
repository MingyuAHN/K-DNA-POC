import os
from functools import lru_cache

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from shared.schemas.seed import (
    BaselineClaimExtractionRequest,
    BaselineClaimExtractionResponse,
)

from ai.agents.baseline_claim_extractor import (
    BaselineClaimExtractor,
)

from shared.schemas.embedding import (
    EmbeddingRequest,
    EmbeddingResponse,
)

from ai.services.embedding_service import (
    EmbeddingService,
)

load_dotenv()


app = FastAPI(
    title="K-DNA AI Service",
    version="0.1.0",
)


@app.get("/health")
def health():
    return {
        "status": "ok"
    }


@lru_cache
def get_baseline_claim_extractor():

    provider = os.getenv(
        "LLM_PROVIDER",
        "openai",
    ).lower()

    if provider == "mock":
        from ai.services.mock_gateway import (
            MockLLMGateway,
        )

        gateway = MockLLMGateway()

    elif provider == "openai":
        from ai.services.openai_gateway import (
            OpenAIGateway,
        )

        gateway = OpenAIGateway()

    else:
        raise ValueError(
            f"지원하지 않는 LLM_PROVIDER: {provider}"
        )

    return BaselineClaimExtractor(
        llm_gateway=gateway
    )


@app.post(
    "/api/v1/ai/baseline-claims/extract",
    response_model=BaselineClaimExtractionResponse,
)
def extract_baseline_claims(
    request: BaselineClaimExtractionRequest,
):
    try:
        extractor = get_baseline_claim_extractor()

        return extractor.extract(request)

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc


@lru_cache
def get_embedding_service():
    return EmbeddingService()


@app.post(
    "/api/v1/ai/embeddings",
    response_model=EmbeddingResponse,
)
def create_embeddings(
    request: EmbeddingRequest,
):
    try:
        service = get_embedding_service()

        return service.embed(request)

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc