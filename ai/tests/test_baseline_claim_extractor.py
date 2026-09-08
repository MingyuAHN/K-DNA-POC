import json
from pathlib import Path

from shared.schemas.seed import (
    BaselineClaimExtractionRequest,
)

from ai.agents.baseline_claim_extractor import (
    BaselineClaimExtractor,
)


class StubLLMGateway:
    def generate_structured(
        self,
        system_prompt,
        user_prompt,
        response_model,
    ):
        mock_result = {
            "chunk_id": "temporary-chunk-id",
            "claims": [
                {
                    "statement": (
                        "Migration Phase 1에서는 "
                        "Shared Physical Database를 사용한다."
                    ),
                    "claim_type": "FACT",
                    "context": {
                        "project": "Project Alpha",
                        "phase": "Migration Phase 1",
                        "domain": "Data Ownership"
                    },
                    "source_chunk_id": "temporary-chunk-id",
                    "source_text": (
                        "Migration Phase 1에서는 Order와 Inventory가 "
                        "Shared Physical Database를 사용하고 "
                        "Schema 수준에서 Logical Separation을 적용한다."
                    ),
                    "confidence_score": 0.95
                }
            ]
        }

        return response_model.model_validate(
            mock_result
        )


def test_baseline_claim_extractor():

    fixture_path = (
        Path(__file__).resolve().parents[1]
        / "fixtures"
        / "adr021_chunk.json"
    )

    data = json.loads(
        fixture_path.read_text(
            encoding="utf-8"
        )
    )

    # Backend → AI 최종 Request Schema
    #
    # {
    #   "chunk_id": "...",
    #   "content": "...",
    #   "source": "...",
    #   "context": {...}
    # }
    request = BaselineClaimExtractionRequest.model_validate(
        data
    )

    extractor = BaselineClaimExtractor(
        llm_gateway=StubLLMGateway()
    )

    result = extractor.extract(
        request
    )

    # Response 최상위 chunk_id 확인
    assert (
        result.chunk_id
        == "chunk-adr021-001"
    )

    # Claim이 정상 생성됐는지 확인
    assert len(result.claims) == 1

    claim = result.claims[0]

    # 기존 type → claim_type
    assert (
        claim.claim_type.value
        == "FACT"
    )

    # LLM이 temporary ID를 반환해도
    # Extractor가 실제 Request의 chunk_id로 보정해야 함
    assert (
        claim.source_chunk_id
        == "chunk-adr021-001"
    )

    # 기존 confidence → confidence_score
    assert (
        claim.confidence_score
        == 0.95
    )

    assert (
        claim.context.phase
        == "Migration Phase 1"
    )

    assert (
        claim.context.domain
        == "Data Ownership"
    )

    assert (
        "Shared Physical Database"
        in claim.source_text
    )