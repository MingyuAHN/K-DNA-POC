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
                    "target_id": "chunk-adr021-001",
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
        source_chunk_id="chunk-adr021-001",
        source="ADR-021",
        content=(
            "Migration Phase 1에서는 Order와 Inventory가 "
            "Shared Physical Database를 사용하고 "
            "Logical Separation을 적용한다."
        ),
        context=ContextTags(
            project="Project Alpha",
            phase="Migration Phase 1",
            domain="Data Ownership",
        ),
        relevance_score=0.95,
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

    assert relation.target_id == "chunk-adr021-001"