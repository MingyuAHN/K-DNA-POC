import json
from pathlib import Path

from shared.schemas.seed import (
    SeedChunkInput,
    BaselineClaimExtractionRequest,
)

from ai.agents.baseline_claim_extractor import (
    BaselineClaimExtractor,
)


class StubLLMGateway:
    """
    실제 LLM API를 호출하지 않고
    미리 정의한 결과를 반환하는 테스트용 Gateway.
    """

    def generate_structured(
        self,
        system_prompt,
        user_prompt,
        response_model,
    ):
        mock_result = {
            "claims": [
                {
                    "statement": (
                        "Migration Phase 1에서는 "
                        "Order와 Inventory가 Shared Physical Database를 "
                        "사용할 수 있다."
                    ),
                    "type": "EXCEPTION",
                    "context": {
                        "project": "Project Alpha",
                        "phase": "Migration Phase 1",
                        "domain": "Data Ownership"
                    },
                    "source_chunk_id": "temporary",
                    "source_text": (
                        "Migration Phase 1에서는 Order와 Inventory가 "
                        "Shared Physical Database를 사용하고 "
                        "Schema 수준에서 Logical Separation을 적용한다."
                    ),
                    "confidence": 0.95
                }
            ]
        }

        return response_model.model_validate(mock_result)


def test_baseline_claim_extractor():

    fixture_path = (
        Path(__file__).resolve().parents[1]
        / "fixtures"
        / "adr021_chunk.json"
    )

    data = json.loads(
        fixture_path.read_text(encoding="utf-8")
    )

    chunk = SeedChunkInput.model_validate(data)

    request = BaselineClaimExtractionRequest(
        chunk=chunk
    )

    extractor = BaselineClaimExtractor(
        llm_gateway=StubLLMGateway()
    )

    result = extractor.extract(request)

    assert len(result.claims) == 1

    claim = result.claims[0]

    assert claim.type.value == "EXCEPTION"

    assert claim.source_chunk_id == "chunk-adr021-001"

    assert claim.confidence == 0.95