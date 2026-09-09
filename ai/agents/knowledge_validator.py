from shared.schemas.validation import (
    KnowledgeValidationRequest,
    KnowledgeValidationResponse,
)

from shared.schemas.enums import ValidationStatus

from ai.services.llm_gateway import LLMGateway
from ai.services.prompt_loader import load_prompt


class KnowledgeValidator:

    def __init__(
        self,
        llm_gateway: LLMGateway,
    ):
        self.llm = llm_gateway

        self.system_prompt = load_prompt(
            "knowledge_validator.md"
        )

    def validate(
        self,
        request: KnowledgeValidationRequest,
    ) -> KnowledgeValidationResponse:

        evidence = [
            item.model_dump()
            for item in request.evidence
        ]

        related_knowledge = [
            item.model_dump()
            for item in request.related_knowledge
        ]

        user_prompt = f"""
다음 Knowledge Unit을 검증하세요.

[Knowledge Unit]

{request.knowledge_unit.model_dump_json(indent=2)}


[Evidence]

{evidence}


[Related Knowledge]

{related_knowledge}


[Expert Confirmed]

{request.expert_confirmed}
"""

        result = self.llm.generate_structured(
            system_prompt=self.system_prompt,
            user_prompt=user_prompt,
            response_model=KnowledgeValidationResponse,
        )

        # Validation Score는 동일한 방식으로 코드에서 계산
        metrics = result.metrics

        scores = [
            metrics.evidence_support,
            metrics.source_independence,
            metrics.cross_expert_agreement,
            metrics.context_completeness,
            metrics.exception_completeness,
            metrics.outcome_evidence,
            metrics.recency,
        ]

        result.overall_score = round(
            sum(scores) / len(scores),
            4,
        )

        # LLM이 임의 Evidence ID를 만들지 못하도록 검증
        valid_source_ids = {
            evidence.source_chunk_id
            for evidence in request.evidence
        }

        for source_id in result.evidence_source_ids:
            if source_id not in valid_source_ids:
                raise ValueError(
                    "Validation result contains unknown evidence ID: "
                    f"{source_id}"
                )

        # Human Confirmation 없는 중요한 Knowledge는
        # 자동 VERIFIED 방지
        if (
            result.validation_status
            == ValidationStatus.VERIFIED
            and request.expert_confirmed is not True
        ):
            result.validation_status = (
                ValidationStatus.VALIDATING
            )

        return result