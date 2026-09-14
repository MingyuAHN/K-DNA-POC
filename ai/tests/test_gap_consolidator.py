from shared.schemas.interview import (
    ConversationMessage,
    GapConsolidationRequest,
    GapConsolidationResponse,
    KnowledgeGap,
    MissionContext,
)

from shared.schemas.enums import (
    GapDimension,
    GapType,
)

from ai.agents.gap_consolidator import (
    GapConsolidator,
)


class StubLLMGateway:
    def generate_structured(
        self,
        system_prompt,
        user_prompt,
        response_model,
    ):
        return GapConsolidationResponse(
            selected_indices=[
                0,
                2,
            ]
        )


def test_gap_consolidator_selects_existing_gap_indices():
    gateway = StubLLMGateway()

    consolidator = GapConsolidator(
        gateway
    )

    gaps = [
        KnowledgeGap(
            topic=(
                "6개월 내 종료 조건 미충족 시 처리"
            ),
            dimension=GapDimension.WHY,
            gap_type=GapType.MISSING_EXCEPTION,
            gap_score=0.86,
            reason=(
                "종료 조건을 충족하지 못했을 때 "
                "후속 처리 기준이 확인되지 않았다."
            ),
        ),
        KnowledgeGap(
            topic=(
                "Shared Database 예외 종료 실패 처리"
            ),
            dimension=GapDimension.EXCEPTION,
            gap_type=GapType.MISSING_EXCEPTION,
            gap_score=0.82,
            reason=(
                "예외 종료 조건 미충족 시 "
                "연장 또는 전환 기준이 확인되지 않았다."
            ),
        ),
        KnowledgeGap(
            topic=(
                "Shared Database 예외 허용 이유"
            ),
            dimension=GapDimension.WHY,
            gap_type=GapType.MISSING_EXCEPTION,
            gap_score=0.72,
            reason=(
                "Shared Database를 예외적으로 허용하는 "
                "판단 근거가 확인되지 않았다."
            ),
        ),
    ]

    request = GapConsolidationRequest(
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
        message=ConversationMessage(
            speaker="EXPERT",
            content=(
                "Shared Database는 초기 전환 기간의 "
                "한시적 예외입니다."
            ),
        ),
        conversation_context=[],
        gaps=gaps,
    )

    result = consolidator.consolidate(
        request
    )

    assert result.selected_indices == [
        0,
        2,
    ]