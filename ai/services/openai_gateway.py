import os
from typing import Type, TypeVar

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel


T = TypeVar("T", bound=BaseModel)


class OpenAIGateway:
    """
    OpenAI Provider용 LLM Gateway 구현체.

    Agent는 OpenAI SDK를 직접 호출하지 않고
    이 Gateway를 통해 Structured Output을 요청한다.
    """

    def __init__(
        self,
        model: str | None = None,
    ):
        load_dotenv()

        api_key = os.getenv("OPENAI_API_KEY")

        if not api_key:
            raise ValueError(
                "OPENAI_API_KEY가 설정되어 있지 않습니다."
            )

        self.model = model or os.getenv("OPENAI_MODEL")

        if not self.model:
            raise ValueError(
                "OPENAI_MODEL이 설정되어 있지 않습니다."
            )

        self.client = OpenAI(
            api_key=api_key
        )

    def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
    ) -> T:

        response = self.client.responses.parse(
            model=self.model,
            input=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
            text_format=response_model,
        )

        result = response.output_parsed

        if result is None:
            raise RuntimeError(
                "LLM Structured Output parsing failed."
            )

        return result