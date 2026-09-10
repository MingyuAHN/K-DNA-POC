from shared.schemas.common import ContextTags

from shared.schemas.interview import (
    RetrievedEvidence,
)

from shared.schemas.synthesis import (
    SynthesizedKnowledgeUnit,
)

from shared.schemas.validation import (
    KnowledgeValidationRequest,
)

from ai.agents.knowledge_validator import (
    KnowledgeValidator,
)


class StubLLMGateway:

    def generate_structured(
        self,
        system_prompt,
        user_prompt,
        response_model,
    ):
        mock_result = {
            "validation_status": "VERIFIED",
            "overall_score": 0.0,

            "metrics": {
                "evidence_support": 0.9,
                "source_independence": 0.5,
                "cross_expert_agreement": 0.4,
                "context_completeness": 0.9,
                "exception_completeness": 0.9,
                "outcome_evidence": 0.5,
                "recency": 0.7
            },

            "evidence_source_ids": [
                "22222222-2222-4222-8222-222222222222"
            ],

            "missing_requirements": [
                "추가 Expert 확인 필요"
            ],

            "recommended_action": "EDIT",

            "reason": (
                "Evidence가 조건부 예외를 지원하지만 "
                "최종 검증을 위해 Expert 확인이 필요하다."
            )
        }

        return response_model.model_validate(
            mock_result
        )


def test_knowledge_validator():

    knowledge = SynthesizedKnowledgeUnit(
        statement=(
            "서비스별 DB 분리를 원칙으로 하되, "
            "Migration 초기 Transaction Coupling이 높은 경우 "
            "Logical Separation을 우선 적용할 수 있다."
        ),
        type="DECISION_RULE",
        context=ContextTags(
            project="Project Alpha",
            phase="Migration Phase 1",
            domain="Data Ownership",
            constraints=[
                "High Transaction Coupling"
            ],
        ),
        decision_rule=None,
        rationale=(
            "초기 단계의 높은 Transaction Coupling"
        ),
        exception=(
            "Migration 초기 High Transaction Coupling"
        ),
        novelty_score=0.9,
        confidence_score=0.93,
        validation_status="CANDIDATE",
    )

    evidence = RetrievedEvidence(
        chunk_id="22222222-2222-4222-8222-222222222222",
        content=(
            "Migration Phase 1에서는 Order와 Inventory가 "
            "Shared Physical Database를 사용하고 "
            "Logical Separation을 적용한다."
        ),
        similarity=0.95,
        document_id="33333333-3333-4333-8333-333333333333",
        file_name="ADR-021.md",
        page=3,
        section="Database Migration Strategy",
        context=ContextTags(
            project="Project Alpha",
            phase="Migration Phase 1",
            domain="Data Ownership",
        ),
    )

    request = KnowledgeValidationRequest(
        knowledge_unit=knowledge,
        evidence=[evidence],
        related_knowledge=[],
        expert_confirmed=None,
    )

    validator = KnowledgeValidator(
        llm_gateway=StubLLMGateway()
    )

    result = validator.validate(
        request
    )

    # Human confirm이 없으므로
    # LLM이 VERIFIED를 반환해도 VALIDATING
    assert (
        result.validation_status.value
        == "VALIDATING"
    )

    assert (
        "22222222-2222-4222-8222-222222222222"
        in result.evidence_source_ids
    )

    assert result.overall_score > 0

    assert (
        result.recommended_action.value
        == "EDIT"
    )