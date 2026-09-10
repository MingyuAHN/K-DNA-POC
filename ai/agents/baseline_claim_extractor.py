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

schema_version:
{request.schema_version}

chunk_id:
{request.chunk_id}

source:
{request.source.model_dump_json(indent=2)}

context:
{request.context.model_dump_json(indent=2)}

content:
{request.content}

중요:
- 응답 schema_version은 입력 schema_version과 동일하게 사용하세요.
- 응답 chunk_id는 입력 chunk_id와 동일하게 사용하세요.
- 각 claim의 source_chunk_id는 입력 chunk_id와 동일하게 사용하세요.
- 새로운 시스템 ID를 생성하지 마세요.
"""

        result = self.llm.generate_structured(
            system_prompt=self.system_prompt,
            user_prompt=user_prompt,
            response_model=BaselineClaimExtractionResponse,
        )

        # 시스템 관리 값은 LLM 결과를 신뢰하지 않고 Request 값으로 최종 보정
        result.schema_version = request.schema_version
        result.chunk_id = request.chunk_id

        for claim in result.claims:
            claim.source_chunk_id = request.chunk_id

        return result
