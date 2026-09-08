from typing import Type, TypeVar

from pydantic import BaseModel


T = TypeVar("T", bound=BaseModel)


class MockLLMGateway:

    def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
    ) -> T:

        if response_model.__name__ == "BaselineClaimExtractionResponse":

            content = ""

            if "[Content]" in user_prompt:
                content = user_prompt.split(
                    "[Content]",
                    1,
                )[1].strip()

            mock_result = {
                "chunk_id": "mock-chunk-id",
                "claims": [
                    {
                        "statement": "Backend 연동 테스트용 Baseline Claim",
                        "claim_type": "FACT",
                        "context": {},
                        "source_chunk_id": "mock-chunk-id",
                        "source_text": content or "Mock source text",
                        "confidence_score": 1.0,
                    }
                ],
            }

            return response_model.model_validate(
                mock_result
            )

        raise ValueError(
            f"Unsupported response model: "
            f"{response_model.__name__}"
        )