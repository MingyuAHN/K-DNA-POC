from shared.schemas.interview import (
    QuestionPlanningRequest,
    QuestionPlanningResponse,
)

from ai.services.llm_gateway import LLMGateway
from ai.services.prompt_loader import load_prompt


class QuestionPlanner:

    def __init__(self, llm_gateway: LLMGateway):
        self.llm = llm_gateway
        self.system_prompt = load_prompt(
            "question_planner.md"
        )

    def plan(
        self,
        request: QuestionPlanningRequest,
    ) -> QuestionPlanningResponse:

        candidate = request.candidate

        gaps = [
            gap.model_dump()
            for gap in request.gaps
        ]

        conflicts = [
            conflict.model_dump()
            for conflict in request.conflicts
        ]

        conversation_context = [
            message.model_dump()
            for message in request.conversation_context
        ]

        user_prompt = f"""
다음 Knowledge Candidate의 Gap과 Conflict를 해소할
후속 질문 후보를 생성하세요.

[Mission]

{request.mission.model_dump_json(indent=2)}


[Knowledge Candidate]

{candidate.model_dump_json(indent=2)}


[Knowledge Gaps]

{gaps}


[Conflicts]

{conflicts}


[Conversation Context]

{conversation_context}
"""

        result = self.llm.generate_structured(
            system_prompt=self.system_prompt,
            user_prompt=user_prompt,
            response_model=QuestionPlanningResponse,
        )

        # LLM이 반환한 세부 점수로 value_score를 다시 계산
        # 최종 점수 계산은 코드에서 일관되게 처리
        for question in result.question_candidates:
            question.value_score = self.calculate_value_score(
                gap_reduction=question.gap_reduction_score,
                conflict_resolution=question.conflict_resolution_score,
                novelty=question.novelty_score,
                business_impact=question.business_impact_score,
                redundancy=question.redundancy_score,
            )

        # 가장 높은 value_score 질문을 최종 질문으로 선택
        if result.question_candidates:
            result.next_question = max(
                result.question_candidates,
                key=lambda q: q.value_score,
            )

        return result

    @staticmethod
    def calculate_value_score(
        gap_reduction: float,
        conflict_resolution: float,
        novelty: float,
        business_impact: float,
        redundancy: float,
    ) -> float:

        score = (
            gap_reduction * 0.30
            + conflict_resolution * 0.25
            + novelty * 0.20
            + business_impact * 0.15
            - redundancy * 0.10
        )

        # Schema가 0~1 범위이므로 혹시 모를 음수 방지
        return max(0.0, min(1.0, round(score, 4)))