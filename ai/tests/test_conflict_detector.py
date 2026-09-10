from shared.schemas.common import ContextTags

from shared.schemas.interview import (
    MissionContext,
    KnowledgeCandidate,
    RetrievedEvidence,
    SemanticRelation,
    ConflictAnalysisRequest,
)

from ai.agents.conflict_detector import ConflictDetector


class StubLLMGateway:

    def generate_structured(
        self,
        system_prompt,
        user_prompt,
        response_model,
    ):
        mock_result = {
            "conflicts": [
                {
                    "conflict_type": "CONDITIONAL_CONFLICT",
                    "severity": "HIGH",
                    "description": (
                        "Database per Service 일반 원칙과 "
                        "Migration Phase 1 Shared DB 적용 사례 사이에 "
                        "조건부 차이가 존재한다."
                    ),
                    "sources": [
                        {
                            "source_type": "EVIDENCE",
                            "source_id": "chunk-adr021-001",
                            "content": (
                                "Migration Phase 1에서는 "
                                "Shared Physical Database를 사용한다."
                            )
                        }
                    ],
                    "context_difference": (
                        "Target Principle vs Migration Phase 1"
                    ),
                    "unknown_condition": (
                        "어떤 조건에서 Shared DB를 "
                        "임시 허용할 수 있는지 확인되지 않았다."
                    ),
                    "recommended_question": (
                        "ADR-021에서는 Migration 초기 Shared DB를 "
                        "사용했습니다. 어떤 조건 때문에 Database per "
                        "Service 원칙을 즉시 적용하지 않았습니까?"
                    )
                }
            ]
        }

        return response_model.model_validate(
            mock_result
        )


def test_conflict_detector():

    candidate = KnowledgeCandidate(
        statement="서비스별 데이터베이스 분리를 원칙으로 한다.",
        type="PRINCIPLE",
        context=ContextTags(
            domain="Data Ownership"
        ),
        decision_rule=None,
        rationale=None,
        exception=None,
        novelty_score=0.5,
        confidence_score=0.9,
        validation_status="CANDIDATE",
    )

    mission = MissionContext(
        mission_id="mission-001",
        domain="MSA",
        objective="Legacy Monolith에서 MSA 전환 판단 지식 발굴",
        focus_topics=[
            "Data Ownership",
            "Migration",
        ],
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

    relation = SemanticRelation(
        target_type="EVIDENCE",
        target_id="chunk-adr021-001",
        relation="CONTEXT_DIFFERS",
        reason=(
            "일반 원칙과 Migration Phase 1이라는 "
            "적용 Context에 차이가 있다."
        ),
        context_difference=(
            "General Principle vs Migration Phase 1"
        ),
    )

    request = ConflictAnalysisRequest(
        candidate=candidate,
        mission=mission,
        semantic_relations=[relation],
        retrieved_knowledge=[],
        retrieved_evidence=[evidence],
    )

    detector = ConflictDetector(
        llm_gateway=StubLLMGateway()
    )

    result = detector.detect(request)

    assert len(result.conflicts) == 1

    conflict = result.conflicts[0]

    assert (
        conflict.conflict_type.value
        == "CONDITIONAL_CONFLICT"
    )

    assert conflict.severity.value == "HIGH"

    assert conflict.unknown_condition is not None

    assert conflict.recommended_question is not None