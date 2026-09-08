from shared.schemas.common import ContextTags

from shared.schemas.interview import (
    MissionContext,
    KnowledgeCandidate,
    KnowledgeGap,
    ConflictResult,
    ConflictSource,
    QuestionPlanningRequest,
)

from ai.agents.question_planner import QuestionPlanner


class StubLLMGateway:

    def generate_structured(
        self,
        system_prompt,
        user_prompt,
        response_model,
    ):
        mock_result = {
            "question_candidates": [
                {
                    "question": (
                        "왜 서비스별 데이터베이스를 "
                        "분리해야 합니까?"
                    ),
                    "question_type": "DEPTH",
                    "target_gap": "WHY",
                    "gap_reduction_score": 0.7,
                    "novelty_score": 0.4,
                    "business_impact_score": 0.6,
                    "conflict_resolution_score": 0.2,
                    "redundancy_score": 0.2,
                    "value_score": 0.0
                },
                {
                    "question": (
                        "ADR-021에서는 Migration 초기 "
                        "Shared DB를 사용했습니다. "
                        "어떤 조건 때문에 Database per Service "
                        "원칙을 즉시 적용하지 않았습니까?"
                    ),
                    "question_type": "CONFLICT_RESOLUTION",
                    "target_gap": "EXCEPTION",
                    "gap_reduction_score": 0.95,
                    "novelty_score": 0.9,
                    "business_impact_score": 0.85,
                    "conflict_resolution_score": 1.0,
                    "redundancy_score": 0.05,
                    "value_score": 0.0
                }
            ],
            "next_question": None
        }

        return response_model.model_validate(
            mock_result
        )


def test_question_planner():

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

    gap = KnowledgeGap(
        topic="Data Ownership",
        dimension="EXCEPTION",
        gap_type="MISSING_EXCEPTION",
        gap_score=1.0,
        reason=(
            "DB를 분리하지 않는 예외 조건이 "
            "확인되지 않았다."
        ),
    )

    conflict = ConflictResult(
        conflict_type="CONDITIONAL_CONFLICT",
        severity="HIGH",
        description=(
            "Database per Service 원칙과 "
            "Migration Phase 1 Shared DB 적용 사례 사이에 "
            "조건부 차이가 존재한다."
        ),
        sources=[
            ConflictSource(
                source_type="EVIDENCE",
                source_id="chunk-adr021-001",
                content=(
                    "Migration Phase 1에서는 "
                    "Shared Physical Database를 사용한다."
                ),
            )
        ],
        context_difference=(
            "Target Principle vs Migration Phase 1"
        ),
        unknown_condition=(
            "Shared DB를 허용하는 조건이 확인되지 않았다."
        ),
        recommended_question=(
            "어떤 조건에서 Shared DB를 허용했습니까?"
        ),
    )

    request = QuestionPlanningRequest(
        candidate=candidate,
        mission=mission,
        gaps=[gap],
        conflicts=[conflict],
        conversation_context=[],
    )

    planner = QuestionPlanner(
        llm_gateway=StubLLMGateway()
    )

    result = planner.plan(request)

    assert len(result.question_candidates) == 2

    assert result.next_question is not None

    assert (
        result.next_question.question_type.value
        == "CONFLICT_RESOLUTION"
    )

    assert (
        "ADR-021"
        in result.next_question.question
    )

    assert (
        result.next_question.value_score
        >
        result.question_candidates[0].value_score
    )