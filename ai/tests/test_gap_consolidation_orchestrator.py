from shared.schemas.interview import (
    ConversationMessage,
    GapConsolidationResponse,
    InterviewAnalysisRequest,
    InterviewContext,
    KnowledgeGap,
    MissionContext,
)

from shared.schemas.enums import (
    GapDimension,
    GapType,
)

from ai.services.langgraph_orchestrator import (
    LangGraphAIOrchestrator,
)


class StubGapConsolidator:
    def consolidate(
        self,
        request,
    ):
        # 두 번째 원본 Gap만 선택
        return GapConsolidationResponse(
            selected_indices=[1]
        )


def test_gap_consolidation_preserves_original_gap():
    original_gaps = [
        KnowledgeGap(
            topic=(
                "6개월 내 종료 조건 미충족 시 처리"
            ),
            dimension=GapDimension.FAILURE,
            gap_type=GapType.MISSING_FAILURE,
            gap_score=0.86,
            reason=(
                "6개월 내 종료 조건을 충족하지 "
                "못한 경우의 처리 기준이 확인되지 않았다."
            ),
        ),
        KnowledgeGap(
            topic=(
                "Shared Database 예외 허용 조건"
            ),
            dimension=GapDimension.EXCEPTION,
            gap_type=GapType.MISSING_EXCEPTION,
            gap_score=0.74,
            reason=(
                "Shared Database를 예외적으로 "
                "허용할 수 있는 조건이 확인되지 않았다."
            ),
        ),
    ]

    request = InterviewAnalysisRequest(
        mission=MissionContext(
            mission_id="mission-test",
            domain="MSA",
            objective=(
                "Shared Database 예외 기준 확인"
            ),
            focus_topics=[
                "Database per Service",
                "Shared Database",
            ],
        ),
        interview=InterviewContext(
            interview_id="interview-test",
        ),
        message=ConversationMessage(
            speaker="EXPERT",
            content=(
                "Shared Database는 초기 전환 단계의 "
                "한시적 예외입니다."
            ),
        ),
        conversation_context=[],
        retrieved_knowledge=[],
        retrieved_knowledge_units=[],
        retrieved_evidence=[],
    )

    orchestrator = LangGraphAIOrchestrator(
        knowledge_extractor=None,
        semantic_aligner=None,
        gap_analyzer=None,
        conflict_detector=None,
        question_planner=None,
        gap_consolidator=(
            StubGapConsolidator()
        ),
    )

    result = orchestrator._gap_consolidate(
        {
            "request": request,
            "reduced_gaps": original_gaps,
        }
    )

    consolidated_gaps = result[
        "reduced_gaps"
    ]

    assert len(consolidated_gaps) == 1

    # selected_indices=[1]이므로
    # 두 번째 원본 Gap이 그대로 남아야 한다.
    assert (
        consolidated_gaps[0].model_dump()
        == original_gaps[1].model_dump()
    )

    # Consolidator가 topic을 새로 작성하면 안 된다.
    assert consolidated_gaps[0].topic == (
        "Shared Database 예외 허용 조건"
    )

    # Consolidator가 reason을 새로 작성하면 안 된다.
    assert consolidated_gaps[0].reason == (
        "Shared Database를 예외적으로 "
        "허용할 수 있는 조건이 확인되지 않았다."
    )

    # score도 원본 그대로 유지되어야 한다.
    assert consolidated_gaps[0].gap_score == 0.74