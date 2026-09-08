import httpx

from app.core.config import settings
from app.schemas.baseline_claim import (
    BaselineClaimExtractionRequest,
    BaselineClaimExtractionResponse,
)
from app.schemas.embedding import (
    EmbeddingRequest,
    EmbeddingResponse,
)
from app.schemas.interview_orchestration import (
    InterviewOrchestrationResponse,
)


class AIClientError(Exception):
    pass


class AIClient:
    def __init__(self) -> None:
        self.base_url = settings.ai_base_url.rstrip("/")

        self.baseline_claim_path = (
            "/"
            + settings.ai_baseline_claim_path.lstrip("/")
        )

        self.embedding_path = (
            "/"
            + settings.ai_embedding_path.lstrip("/")
        )

        self.interview_analyze_path = (
            "/"
            + settings.ai_interview_analyze_path.lstrip("/")
        )

        self.timeout = settings.ai_request_timeout

    def _post(
        self,
        path: str,
        payload: dict,
    ) -> dict:

        url = f"{self.base_url}{path}"

        try:
            response = httpx.post(
                url=url,
                json=payload,
                timeout=self.timeout,
            )

            response.raise_for_status()

            return response.json()

        except httpx.TimeoutException as exc:
            raise AIClientError(
                f"AI request timed out: {exc}"
            ) from exc

        except httpx.ConnectError as exc:
            raise AIClientError(
                f"Could not connect to AI server: {exc}"
            ) from exc

        except httpx.HTTPStatusError as exc:
            raise AIClientError(
                "AI server returned error "
                f"{exc.response.status_code}: "
                f"{exc.response.text}"
            ) from exc

        except httpx.HTTPError as exc:
            raise AIClientError(
                f"AI request failed: {exc}"
            ) from exc

        except ValueError as exc:
            raise AIClientError(
                f"AI server returned invalid JSON: {exc}"
            ) from exc

    def extract_baseline_claims(
        self,
        request: BaselineClaimExtractionRequest,
    ) -> BaselineClaimExtractionResponse:

        data = self._post(
            path=self.baseline_claim_path,
            payload=request.model_dump(
                mode="json"
            ),
        )

        try:
            return (
                BaselineClaimExtractionResponse
                .model_validate(data)
            )

        except Exception as exc:
            raise AIClientError(
                "Invalid baseline claim response "
                f"schema: {exc}"
            ) from exc

    def create_embeddings(
        self,
        request: EmbeddingRequest,
    ) -> EmbeddingResponse:

        data = self._post(
            path=self.embedding_path,
            payload=request.model_dump(
                mode="json"
            ),
        )

        try:
            return EmbeddingResponse.model_validate(
                data
            )

        except Exception as exc:
            raise AIClientError(
                "Invalid embedding response "
                f"schema: {exc}"
            ) from exc

    def analyze_interview(
        self,
        payload: dict,
    ) -> InterviewOrchestrationResponse:

        data = self._post(
            path=self.interview_analyze_path,
            payload=payload,
        )

        try:
            return (
                InterviewOrchestrationResponse
                .model_validate(data)
            )

        except Exception as exc:
            raise AIClientError(
                "Invalid interview orchestration "
                f"response schema: {exc}"
            ) from exc


ai_client = AIClient()