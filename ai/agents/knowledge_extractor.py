from shared.schemas.interview import (
    InterviewAnalysisRequest,
    KnowledgeExtractionResponse,
)

from ai.services.llm_gateway import LLMGateway
from ai.services.prompt_loader import load_prompt


class KnowledgeExtractor:

    def __init__(self, llm_gateway: LLMGateway):
        self.llm = llm_gateway
        self.system_prompt = load_prompt(
            "knowledge_extractor.md"
        )

    def extract(
        self,
        request: InterviewAnalysisRequest,
    ) -> KnowledgeExtractionResponse:

        mission = request.mission
        interview = request.interview

        user_prompt = f"""
다음 전문가 답변에서 Atomic Knowledge Candidate를 추출하세요.

[Mission]
mission_id: {mission.mission_id}
domain: {mission.domain}
objective: {mission.objective}
focus_topics: {mission.focus_topics}

[Interview]
interview_id: {interview.interview_id}
expert_id: {interview.expert_id}

[Conversation Context]
{[message.model_dump() for message in request.conversation_context]}

[Expert Answer]
{request.message.content}
"""

        return self.llm.generate_structured(
            system_prompt=self.system_prompt,
            user_prompt=user_prompt,
            response_model=KnowledgeExtractionResponse,
        )