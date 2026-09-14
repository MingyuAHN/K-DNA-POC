from shared.schemas.interview import (
    GapConsolidationRequest,
    GapConsolidationResponse,
)

from ai.services.llm_gateway import LLMGateway
from ai.services.prompt_loader import load_prompt


class GapConsolidator:

    def __init__(
        self,
        llm_gateway: LLMGateway,
    ):
        self.llm = llm_gateway
        self.system_prompt = load_prompt(
            "gap_consolidator.md"
        )

    def consolidate(
        self,
        request: GapConsolidationRequest,
    ) -> GapConsolidationResponse:

        # Gap이 없으면 선택할 index도 없다.
        if not request.gaps:
            return GapConsolidationResponse(
                selected_indices=[]
            )

        # Gap이 1개인 경우에도
        # 이미 대화에서 해결되었는지 LLM이 판단할 수 있도록
        # 그대로 Consolidator를 실행한다.

        current_message = (
            request.message.model_dump(
                mode="json"
            )
        )

        conversation_context = [
            message.model_dump(
                mode="json"
            )
            for message
            in request.conversation_context
        ]

        indexed_gaps = [
            {
                "index": index,
                "gap": gap.model_dump(
                    mode="json"
                ),
            }
            for index, gap
            in enumerate(request.gaps)
        ]

        user_prompt = f"""
다음 Gap 후보들을 의미 기준으로 정리하세요.

중요:
최종 응답에는 Gap 내용을 다시 작성하지 말고
유지할 Gap의 index만 반환하세요.

index는 0부터 시작하며,
입력에 존재하는 index만 사용할 수 있습니다.


[Current Expert Message]

{current_message}


[Conversation Context]

{conversation_context}


[Mission]

{request.mission.model_dump(mode="json")}


[Indexed Gap Candidates]

{indexed_gaps}
"""

        return self.llm.generate_structured(
            system_prompt=self.system_prompt,
            user_prompt=user_prompt,
            response_model=GapConsolidationResponse,
        )