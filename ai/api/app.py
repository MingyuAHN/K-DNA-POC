from functools import lru_cache

from fastapi import FastAPI, HTTPException

from shared.schemas.seed import (
    BaselineClaimExtractionRequest,
    BaselineClaimExtractionResponse,
)

from ai.agents.baseline_claim_extractor import (
    BaselineClaimExtractor,
)


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
    # 실제 요청이 들어올 때만 Gateway 생성
    from ai.services.openai_gateway import OpenAIGateway

    gateway = OpenAIGateway()

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