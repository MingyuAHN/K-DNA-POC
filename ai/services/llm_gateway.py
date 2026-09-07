from typing import Protocol, Type, TypeVar

from pydantic import BaseModel


T = TypeVar("T", bound=BaseModel)


class LLMGateway(Protocol):
    """
    모든 AI Agent가 공통으로 사용하는 LLM Gateway 인터페이스.

    각 Agent가 OpenAI 등의 Provider SDK를
    직접 호출하지 않도록 분리한다.
    """

    def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
    ) -> T:
        ...