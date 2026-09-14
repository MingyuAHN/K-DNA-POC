from shared.schemas.interview import (
    GapAnalysisRequest,
    GapAnalysisResponse,
)

from ai.services.llm_gateway import LLMGateway
from ai.services.prompt_loader import load_prompt


class GapAnalyzer:

    def __init__(self, llm_gateway: LLMGateway):
        self.llm = llm_gateway
        self.system_prompt = load_prompt(
            "gap_analyzer.md"
        )

    def analyze(
        self,
        request: GapAnalysisRequest,
    ) -> GapAnalysisResponse:

        candidate = request.candidate
        mission = request.mission

        # 현재 Turn의 전문가 원문 답변
        current_message = (
            request.message.model_dump(
                mode="json"
            )
        )

        # 이전 Turn 전체 대화 이력
        conversation_context = [
            message.model_dump(
                mode="json"
            )
            for message
            in request.conversation_context
        ]

        retrieved_knowledge = [
            knowledge.model_dump(
                mode="json"
            )
            for knowledge
            in request.retrieved_knowledge
        ]

        retrieved_knowledge_units = [
            knowledge_unit.model_dump(
                mode="json"
            )
            for knowledge_unit
            in request.retrieved_knowledge_units
        ]

        retrieved_evidence = [
            evidence.model_dump(
                mode="json"
            )
            for evidence
            in request.retrieved_evidence
        ]

        user_prompt = f"""
다음 대화 전체를 기준으로 Knowledge Gap을 분석하세요.

Gap을 생성하기 전에 반드시
Current Expert Message와 Conversation Context를 먼저 확인하세요.

현재 또는 이전 답변에서 이미 명시적으로 답변된 항목은
Gap으로 생성하지 마세요.

현재 답변이 기존 부족 정보를 구체화한 경우,
이미 답변된 상위 질문을 다시 Gap으로 생성하지 말고
아직 확인되지 않은 세부 정보만 Gap으로 생성하세요.

각 Gap을 최종 출력하기 직전에 반드시 다음을 확인하세요.

"이 Gap에 대한 답이 Current Expert Message 또는
Conversation Context에 이미 존재하는가?"

답이 존재하거나 의미적으로 충분히 답변되었다면
해당 Gap을 출력에서 제거하세요.


[Current Expert Message]

{current_message}


[Conversation Context]

{conversation_context}


[Mission]

mission_id:
{mission.mission_id}

domain:
{mission.domain}

objective:
{mission.objective}

focus_topics:
{mission.focus_topics}


[Knowledge Candidate]

{candidate.model_dump_json(indent=2)}


[Retrieved Baseline Knowledge]

{retrieved_knowledge}


[Retrieved Existing Knowledge Units]

{retrieved_knowledge_units}


[Retrieved Evidence]

{retrieved_evidence}
"""

        return self.llm.generate_structured(
            system_prompt=self.system_prompt,
            user_prompt=user_prompt,
            response_model=GapAnalysisResponse,
        )