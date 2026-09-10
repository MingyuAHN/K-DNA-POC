from shared.schemas.interview import (
    SemanticAlignmentRequest,
    SemanticAlignmentResponse,
)

from ai.services.llm_gateway import LLMGateway
from ai.services.prompt_loader import load_prompt


class SemanticAligner:

    def __init__(self, llm_gateway: LLMGateway):
        self.llm = llm_gateway
        self.system_prompt = load_prompt(
            "semantic_aligner.md"
        )

    def align(
        self,
        request: SemanticAlignmentRequest,
    ) -> SemanticAlignmentResponse:

        candidate = request.candidate

        knowledge_data = [
            knowledge.model_dump(mode="json")
            for knowledge in request.retrieved_knowledge
        ]

        evidence_data = [
            evidence.model_dump(mode="json")
            for evidence in request.retrieved_evidence
        ]

        user_prompt = f"""
다음 Knowledge Candidate와 기존 Knowledge/Evidence 사이의
Semantic Relation을 판정하세요.

[Knowledge Candidate]

{candidate.model_dump_json(indent=2)}

[Retrieved Knowledge]

{knowledge_data}

[Retrieved Evidence]

{evidence_data}
"""

        return self.llm.generate_structured(
            system_prompt=self.system_prompt,
            user_prompt=user_prompt,
            response_model=SemanticAlignmentResponse,
        )