from shared.schemas.synthesis import (
    KnowledgeSynthesisRequest,
    KnowledgeSynthesisResponse,
)

from ai.services.llm_gateway import LLMGateway
from ai.services.prompt_loader import load_prompt


class KnowledgeSynthesizer:

    def __init__(
        self,
        llm_gateway: LLMGateway,
    ):
        self.llm = llm_gateway

        self.system_prompt = load_prompt(
            "knowledge_synthesizer.md"
        )

    def synthesize(
        self,
        request: KnowledgeSynthesisRequest,
    ) -> KnowledgeSynthesisResponse:

        existing_knowledge = [
            knowledge.model_dump()
            for knowledge
            in request.existing_knowledge
        ]

        user_prompt = f"""
다음 Knowledge Candidate를 기존 Knowledge Unit과 비교하여
Knowledge Synthesis를 수행하세요.

[Knowledge Candidate]

{request.candidate.model_dump_json(indent=2)}


[Existing Knowledge Units]

{existing_knowledge}
"""

        return self.llm.generate_structured(
            system_prompt=self.system_prompt,
            user_prompt=user_prompt,
            response_model=KnowledgeSynthesisResponse,
        )