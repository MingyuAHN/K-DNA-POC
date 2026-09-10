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

        result = self.llm.generate_structured(
            system_prompt=self.system_prompt,
            user_prompt=user_prompt,
            response_model=KnowledgeSynthesisResponse,
        )

        valid_knowledge_ids = {
            knowledge.knowledge_id
            for knowledge in request.existing_knowledge
        }

        for target_id in result.target_knowledge_ids:
            if target_id not in valid_knowledge_ids:
                raise ValueError(
                    "Synthesis result contains unknown target_knowledge_id: "
                    f"{target_id}"
                )

        for relation in result.relations:
            if relation.target_knowledge_id not in valid_knowledge_ids:
                raise ValueError(
                    "Synthesis relation contains unknown target_knowledge_id: "
                    f"{relation.target_knowledge_id}"
                )

        return result