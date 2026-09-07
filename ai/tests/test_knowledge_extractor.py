import json
from pathlib import Path

from shared.schemas.interview import (
    InterviewAnalysisRequest,
)

from ai.agents.knowledge_extractor import (
    KnowledgeExtractor,
)


class StubLLMGateway:

    def generate_structured(
        self,
        system_prompt,
        user_prompt,
        response_model,
    ):
        mock_result = {
            "knowledge_candidates": [
                {
                    "statement": (
                        "서비스별 데이터베이스 분리를 "
                        "원칙으로 한다."
                    ),
                    "type": "PRINCIPLE",
                    "context": {},
                    "decision_rule": None,
                    "rationale": None,
                    "exception": None,
                    "novelty_score": 0.5,
                    "confidence_score": 0.9,
                    "validation_status": "CANDIDATE"
                }
            ]
        }

        return response_model.model_validate(
            mock_result
        )


def test_knowledge_extractor():

    fixture_path = (
        Path(__file__).resolve().parents[1]
        / "fixtures"
        / "killer_demo_request.json"
    )

    data = json.loads(
        fixture_path.read_text(
            encoding="utf-8"
        )
    )

    request = InterviewAnalysisRequest.model_validate(
        data
    )

    extractor = KnowledgeExtractor(
        llm_gateway=StubLLMGateway()
    )

    result = extractor.extract(request)

    assert len(
        result.knowledge_candidates
    ) == 1

    candidate = result.knowledge_candidates[0]

    assert candidate.type.value == "PRINCIPLE"

    assert (
        candidate.validation_status.value
        == "CANDIDATE"
    )

    assert candidate.confidence_score == 0.9