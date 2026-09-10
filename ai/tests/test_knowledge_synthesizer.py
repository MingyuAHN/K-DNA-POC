from shared.schemas.common import ContextTags

from shared.schemas.interview import (
    KnowledgeCandidate,
)

from shared.schemas.synthesis import (
    ExistingKnowledgeUnit,
    KnowledgeSynthesisRequest,
)

from ai.agents.knowledge_synthesizer import (
    KnowledgeSynthesizer,
)


class StubLLMGateway:

    def generate_structured(
        self,
        system_prompt,
        user_prompt,
        response_model,
    ):
        mock_result = {
            "operation": "ADD_EXCEPTION",

            "target_knowledge_ids": [
                "ku-001"
            ],

            "synthesized_knowledge_units": [
                {
                    "statement": (
                        "서비스별 데이터베이스 분리를 원칙으로 하되, "
                        "Migration 초기 Transaction Coupling이 높은 경우 "
                        "물리적 분리를 유예하고 Logical Separation을 "
                        "우선 적용할 수 있다."
                    ),

                    "type": "DECISION_RULE",

                    "context": {
                        "project": "Project Alpha",
                        "phase": "Migration Phase 1",
                        "domain": "Data Ownership",
                        "constraints": [
                            "High Transaction Coupling"
                        ],
                        "tags": []
                    },

                    "decision_rule": {
                        "if_conditions": [
                            "Migration 초기 단계",
                            "Transaction Coupling이 높음"
                        ],
                        "then": (
                            "물리적 데이터베이스 분리를 유예하고 "
                            "Logical Separation을 우선 적용할 수 있다."
                        ),
                        "unless": []
                    },

                    "rationale": (
                        "Transaction Coupling이 높은 초기 단계에서는 "
                        "즉시 물리적 분리가 어려울 수 있다."
                    ),

                    "exception": (
                        "Migration 초기 High Transaction Coupling 상황"
                    ),

                    "novelty_score": 0.9,
                    "confidence_score": 0.93,
                    "validation_status": "CANDIDATE"
                }
            ],

            "relations": [
                {
                    "synthesized_index": 0,
                    "target_knowledge_id": "ku-001",
                    "relation": "HAS_EXCEPTION",
                    "reason": (
                        "기존 DB 분리 원칙에 "
                        "Migration 초기의 조건부 예외가 추가되었다."
                    )
                }
            ],

            "reason": (
                "새 Candidate가 기존 Principle을 폐기하는 것이 아니라 "
                "적용 예외 조건을 구체화하므로 "
                "ADD_EXCEPTION으로 판단했다."
            )
        }

        return response_model.model_validate(
            mock_result
        )


def test_knowledge_synthesizer():

    candidate = KnowledgeCandidate(
        statement=(
            "Transaction Coupling이 높아 "
            "Migration 초기에는 DB를 분리하지 않았다."
        ),
        type="DECISION_RULE",
        context=ContextTags(
            project="Project Alpha",
            phase="Migration Phase 1",
            domain="Data Ownership",
        ),
        decision_rule=None,
        rationale=(
            "Transaction Coupling이 높았다."
        ),
        exception=None,
        novelty_score=0.9,
        confidence_score=0.95,
        validation_status="CANDIDATE",
    )

    existing = ExistingKnowledgeUnit(
        knowledge_id="ku-001",
        statement=(
            "서비스별 데이터베이스는 분리해야 한다."
        ),
        type="PRINCIPLE",
        context=ContextTags(
            domain="Data Ownership"
        ),
        decision_rule=None,
        rationale=None,
        exception=None,
        confidence_score=0.9,
        validation_status="VERIFIED",
    )

    request = KnowledgeSynthesisRequest(
        candidate=candidate,
        existing_knowledge=[
            existing
        ],
    )

    synthesizer = KnowledgeSynthesizer(
        llm_gateway=StubLLMGateway()
    )

    result = synthesizer.synthesize(
        request
    )

    assert (
        result.operation.value
        == "ADD_EXCEPTION"
    )

    assert (
        result.target_knowledge_ids
        == ["ku-001"]
    )

    assert (
        len(result.synthesized_knowledge_units)
        == 1
    )

    synthesized = (
        result.synthesized_knowledge_units[0]
    )

    assert (
        synthesized.type.value
        == "DECISION_RULE"
    )

    assert (
        synthesized.validation_status.value
        == "CANDIDATE"
    )

    assert len(result.relations) == 1

    assert (
        result.relations[0].relation.value
        == "HAS_EXCEPTION"
    )