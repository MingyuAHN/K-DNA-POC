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

        retrieved_knowledge = [
            knowledge.model_dump()
            for knowledge in request.retrieved_knowledge
        ]

        retrieved_evidence = [
            evidence.model_dump()
            for evidence in request.retrieved_evidence
        ]

        conversation_context = [
            message.model_dump()
            for message in request.conversation_context
        ]

        user_prompt = f"""
다음 Knowledge Candidate의 Knowledge Gap을 분석하세요.

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


[Conversation Context]

{conversation_context}


[Retrieved Knowledge]

{retrieved_knowledge}


[Retrieved Evidence]

{retrieved_evidence}
"""

        return self.llm.generate_structured(
            system_prompt=self.system_prompt,
            user_prompt=user_prompt,
            response_model=GapAnalysisResponse,
        )