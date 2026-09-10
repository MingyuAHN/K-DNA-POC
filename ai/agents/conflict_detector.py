from shared.schemas.interview import (
    ConflictAnalysisRequest,
    ConflictAnalysisResponse,
)

from ai.services.llm_gateway import LLMGateway
from ai.services.prompt_loader import load_prompt


class ConflictDetector:

    def __init__(self, llm_gateway: LLMGateway):
        self.llm = llm_gateway
        self.system_prompt = load_prompt(
            "conflict_detector.md"
        )

    def detect(
        self,
        request: ConflictAnalysisRequest,
    ) -> ConflictAnalysisResponse:

        candidate = request.candidate

        relations = [
            relation.model_dump()
            for relation in request.semantic_relations
        ]

        knowledge = [
            item.model_dump()
            for item in request.retrieved_knowledge
        ]

        evidence = [
            item.model_dump()
            for item in request.retrieved_evidence
        ]

        user_prompt = f"""
다음 Knowledge Candidate와 기존 Knowledge/Evidence 사이의
Conflict를 분석하세요.

[Mission]

{request.mission.model_dump_json(indent=2)}


[Knowledge Candidate]

{candidate.model_dump_json(indent=2)}


[Semantic Relations]

{relations}


[Retrieved Knowledge]

{knowledge}


[Retrieved Evidence]

{evidence}
"""

        return self.llm.generate_structured(
            system_prompt=self.system_prompt,
            user_prompt=user_prompt,
            response_model=ConflictAnalysisResponse,
        )