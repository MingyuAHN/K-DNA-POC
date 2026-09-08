import os

from dotenv import load_dotenv
from openai import OpenAI

from shared.schemas.embedding import (
    EmbeddingRequest,
    EmbeddingResponse,
    EmbeddingResult,
)


class EmbeddingService:

    def __init__(self):
        load_dotenv()

        api_key = os.getenv("OPENAI_API_KEY")

        if not api_key:
            raise ValueError(
                "OPENAI_API_KEY가 설정되어 있지 않습니다."
            )

        self.model = os.getenv(
            "OPENAI_EMBEDDING_MODEL",
            "text-embedding-3-small",
        )

        self.dimension = int(
            os.getenv(
                "EMBEDDING_DIMENSION",
                "1536",
            )
        )

        self.client = OpenAI(
            api_key=api_key
        )

    def embed(
        self,
        request: EmbeddingRequest,
    ) -> EmbeddingResponse:

        texts = [
            item.text
            for item in request.items
        ]

        response = self.client.embeddings.create(
            model=self.model,
            input=texts,
            dimensions=self.dimension,
            encoding_format="float",
        )

        results = []

        for item, embedding_data in zip(
            request.items,
            response.data,
        ):
            vector = embedding_data.embedding

            if len(vector) != self.dimension:
                raise RuntimeError(
                    "Embedding dimension mismatch: "
                    f"expected={self.dimension}, "
                    f"actual={len(vector)}"
                )

            results.append(
                EmbeddingResult(
                    item_id=item.item_id,
                    item_type=item.item_type,
                    vector=vector,
                )
            )

        return EmbeddingResponse(
            model=self.model,
            dimension=self.dimension,
            embeddings=results,
        )