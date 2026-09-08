from shared.schemas.seed import (
    BaselineClaimExtractionRequest,
    BaselineClaimExtractionResponse,
)

from ai.services.llm_gateway import LLMGateway
from ai.services.prompt_loader import load_prompt


class BaselineClaimExtractor:

    def __init__(self, llm_gateway: LLMGateway):
        self.llm = llm_gateway
        self.system_prompt = load_prompt(
            "baseline_claim_extractor.md"
        )

    def extract(
        self,
        request: BaselineClaimExtractionRequest,
    ) -> BaselineClaimExtractionResponse:

        user_prompt = f"""
다음 Document Chunk에서 Atomic Baseline Claim을 추출하세요.

chunk_id:
{request.chunk_id}

source:
{request.source}

context:
{request.context.model_dump_json(indent=2)}

content:
{request.content}
"""

        result = self.llm.generate_structured(
            system_prompt=self.system_prompt,
            user_prompt=user_prompt,
            response_model=BaselineClaimExtractionResponse,
        )

        # 시스템 관리 ID는 LLM 생성값을 신뢰하지 않고 입력값으로 보정
        result.chunk_id = request.chunk_id

        for claim in result.claims:
            claim.source_chunk_id = request.chunk_id

        return result