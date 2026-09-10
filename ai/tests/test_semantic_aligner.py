from shared.schemas.interview import (
    KnowledgeCandidate,
    RetrievedEvidence,
    SemanticAlignmentRequest,
)

from shared.schemas.common import ContextTags

from ai.agents.semantic_aligner import SemanticAligner


class StubLLMGateway:

    def generate_structured(
        self,
        system_prompt,
        user_prompt,
        response_model,
    ):
        mock_result = {
            "relations": [
                {
                    "target_type": "EVIDENCE",
                    "target_id": "22222222-2222-4222-8222-222222222222",
                    "relation": "CONTEXT_DIFFERS",
                    "reason": (
                        "Candidate는 일반적인 Database per Service "
                        "원칙을 설명하지만 Evidence는 Legacy Migration "
                        "Phase 1의 단계적 적용 사례를 설명한다."
                    ),
                    "context_difference": (
                        "General Principle vs Migration Phase 1"
                    )
                }
            ]
        }

        return response_model.model_validate(
            mock_result
        )


def test_semantic_aligner():

    candidate = KnowledgeCandidate(
        statement="서비스별 데이터베이스 분리를 원칙으로 한다.",
        type="PRINCIPLE",
        context=ContextTags(),
        decision_rule=None,
        rationale=None,
        exception=None,
        novelty_score=0.5,
        confidence_score=0.9,
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

    request = SemanticAlignmentRequest(
        candidate=candidate,
        retrieved_knowledge=[],
        retrieved_evidence=[evidence],
    )

    aligner = SemanticAligner(
        llm_gateway=StubLLMGateway()
    )

    result = aligner.align(request)

    assert len(result.relations) == 1

    relation = result.relations[0]

    assert relation.relation.value == "CONTEXT_DIFFERS"

    assert relation.target_type.value == "EVIDENCE"

    assert relation.target_id == "22222222-2222-4222-8222-222222222222"