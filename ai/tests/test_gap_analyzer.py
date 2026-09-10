from shared.schemas.common import ContextTags

from shared.schemas.interview import (
    MissionContext,
    KnowledgeCandidate,
    GapAnalysisRequest,
)

from ai.agents.gap_analyzer import GapAnalyzer


class StubLLMGateway:

    def generate_structured(
        self,
        system_prompt,
        user_prompt,
        response_model,
    ):
        mock_result = {
            "gaps": [
                {
                    "topic": "Data Ownership",
                    "dimension": "WHY",
                    "gap_type": "MISSING_KNOWLEDGE",
                    "gap_score": 0.8,
                    "reason": (
                        "서비스별 DB를 분리해야 하는 이유가 "
                        "설명되지 않았다."
                    )
                },
                {
                    "topic": "Data Ownership",
                    "dimension": "WHEN",
                    "gap_type": "MISSING_CONTEXT",
                    "gap_score": 0.9,
                    "reason": (
                        "DB 분리 원칙을 적용하는 시점이나 "
                        "Migration Phase 조건이 명확하지 않다."
                    )
                },
                {
                    "topic": "Data Ownership",
                    "dimension": "EXCEPTION",
                    "gap_type": "MISSING_EXCEPTION",
                    "gap_score": 1.0,
                    "reason": (
                        "DB를 분리하지 않을 수 있는 "
                        "예외 조건이 제시되지 않았다."
                    )
                }
            ]
        }

        return response_model.model_validate(
            mock_result
        )


def test_gap_analyzer():

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
        objective=(
            "Legacy Monolith에서 MSA 전환 "
            "판단 지식 발굴"
        ),
        focus_topics=[
            "Data Ownership",
            "Migration",
        ],
    )

    request = GapAnalysisRequest(
        candidate=candidate,
        mission=mission,
        conversation_context=[],
        retrieved_knowledge=[],
        retrieved_evidence=[],
    )

    analyzer = GapAnalyzer(
        llm_gateway=StubLLMGateway()
    )

    result = analyzer.analyze(request)

    assert len(result.gaps) == 3

    dimensions = [
        gap.dimension.value
        for gap in result.gaps
    ]

    assert "WHY" in dimensions
    assert "WHEN" in dimensions
    assert "EXCEPTION" in dimensions

    exception_gap = next(
        gap
        for gap in result.gaps
        if gap.dimension.value == "EXCEPTION"
    )

    assert exception_gap.gap_score == 1.0