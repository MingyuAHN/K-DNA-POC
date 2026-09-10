import json
from pathlib import Path
from uuid import UUID

import pytest
from pydantic import ValidationError

from shared.schemas.seed import (
    BaselineClaim,
    BaselineClaimExtractionRequest,
)
from ai.agents.baseline_claim_extractor import (
    BaselineClaimExtractor,
)


REQUEST_CHUNK_ID = UUID(
    "550e8400-e29b-41d4-a716-446655440000"
)

TEMP_LLM_CHUNK_ID = (
    "00000000-0000-0000-0000-000000000001"
)

ALLOWED_BASELINE_TYPES = {
    "PRINCIPLE",
    "DECISION",
    "EXCEPTION",
    "OUTCOME",
}


class StubLLMGateway:

    def generate_structured(
        self,
        system_prompt,
        user_prompt,
        response_model,
    ):
        mock_result = {
            "schema_version": "1.0",
            "chunk_id": TEMP_LLM_CHUNK_ID,
            "claims": [
                {
                    "statement": (
                        "Migration Phase 1에서는 "
                        "Shared Physical Database를 사용하기로 결정했다."
                    ),
                    "claim_type": "DECISION",
                    "context": {
                        "project": "Project Alpha",
                        "phase": "Migration Phase 1",
                        "domain": "Data Ownership",
                        "system": "Order/Inventory",
                        "scope": None,
                        "time": None,
                        "constraints": [],
                        "tags": [],
                    },
                    "source_chunk_id": TEMP_LLM_CHUNK_ID,
                    "source_text": (
                        "Migration Phase 1에서는 Order와 Inventory가 "
                        "Shared Physical Database를 사용하고 "
                        "Schema 수준에서 Logical Separation을 적용한다."
                    ),
                    "confidence_score": 0.95,
                }
            ],
        }

        return response_model.model_validate(
            mock_result
        )


def _fixture_data():
    fixture_path = (
        Path(__file__).resolve().parents[1]
        / "fixtures"
        / "adr021_chunk.json"
    )

    return json.loads(
        fixture_path.read_text(
            encoding="utf-8"
        )
    )


def _claim_data(claim_type: str):
    return {
        "statement": "테스트 Claim",
        "claim_type": claim_type,
        "context": {},
        "source_chunk_id": str(REQUEST_CHUNK_ID),
        "source_text": "테스트 원문",
        "confidence_score": 0.9,
    }


def test_baseline_request_v1_contract():
    request = (
        BaselineClaimExtractionRequest.model_validate(
            _fixture_data()
        )
    )

    assert request.schema_version == "1.0"
    assert request.chunk_id == REQUEST_CHUNK_ID

    assert request.source.file_name == "ADR-021.md"
    assert request.source.page == 3
    assert (
        request.source.section
        == "Database Migration Strategy"
    )

    assert request.context.domain == "Data Ownership"
    assert request.context.project == "Project Alpha"
    assert request.context.phase == "Migration Phase 1"


def test_context_optional_fields_and_list_defaults():
    request = (
        BaselineClaimExtractionRequest.model_validate(
            {
                "schema_version": "1.0",
                "chunk_id": str(REQUEST_CHUNK_ID),
                "content": "테스트 문서 내용",
                "source": {
                    "file_name": "sample.txt"
                },
                "context": {},
            }
        )
    )

    assert request.source.page is None
    assert request.source.section is None

    assert request.context.domain is None
    assert request.context.project is None
    assert request.context.phase is None
    assert request.context.system is None
    assert request.context.scope is None
    assert request.context.time is None

    assert request.context.constraints == []
    assert request.context.tags == []


def test_context_objective_is_rejected():
    data = _fixture_data()
    data["context"]["objective"] = (
        "이 필드는 ContextTags에 포함되지 않는다."
    )

    with pytest.raises(ValidationError):
        BaselineClaimExtractionRequest.model_validate(
            data
        )


def test_source_string_is_rejected():
    data = _fixture_data()
    data["source"] = "ADR-021"

    with pytest.raises(ValidationError):
        BaselineClaimExtractionRequest.model_validate(
            data
        )


def test_invalid_chunk_id_is_rejected():
    data = _fixture_data()
    data["chunk_id"] = "chunk-adr021-001"

    with pytest.raises(ValidationError):
        BaselineClaimExtractionRequest.model_validate(
            data
        )


@pytest.mark.parametrize(
    "claim_type",
    sorted(ALLOWED_BASELINE_TYPES),
)
def test_baseline_claim_allows_only_design_types(
    claim_type,
):
    claim = BaselineClaim.model_validate(
        _claim_data(claim_type)
    )

    assert claim.claim_type == claim_type


@pytest.mark.parametrize(
    "invalid_type",
    [
        "FACT",
        "DECISION_RULE",
        "HEURISTIC",
        "FAILURE_LESSON",
        "TRADE_OFF",
        "EXPERT_OPINION",
    ],
)
def test_baseline_claim_rejects_interview_types(
    invalid_type,
):
    with pytest.raises(ValidationError):
        BaselineClaim.model_validate(
            _claim_data(invalid_type)
        )


def test_baseline_claim_extractor_v1_echo_contract():
    request = (
        BaselineClaimExtractionRequest.model_validate(
            _fixture_data()
        )
    )

    extractor = BaselineClaimExtractor(
        llm_gateway=StubLLMGateway()
    )

    result = extractor.extract(
        request
    )

    assert result.schema_version == "1.0"
    assert result.chunk_id == REQUEST_CHUNK_ID

    assert len(result.claims) == 1
    claim = result.claims[0]

    assert claim.claim_type == "DECISION"

    # LLM이 임시 UUID를 반환해도 실제 Request UUID로 보정
    assert claim.source_chunk_id == REQUEST_CHUNK_ID

    assert claim.confidence_score == 0.95
    assert claim.context.phase == "Migration Phase 1"
    assert claim.context.domain == "Data Ownership"

    assert (
        "Shared Physical Database"
        in claim.source_text
    )
