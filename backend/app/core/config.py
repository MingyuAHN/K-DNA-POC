from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


class Settings(BaseSettings):
    db_user: str
    db_password: str
    db_host: str
    db_port: int = 5432
    db_name: str = "postgres"

    supabase_url: str
    supabase_secret_key: str

    ai_base_url: str = (
        "http://127.0.0.1:8001"
    )

    ai_baseline_claim_path: str = (
        "/api/v1/ai/baseline-claims/extract"
    )

    ai_embedding_path: str = (
        "/api/v1/ai/embeddings"
    )

    ai_interview_analyze_path: str = (
        "/api/v1/ai/interviews/analyze"
    )

    ai_knowledge_synthesis_path: str = (
        "/api/v1/ai/knowledge/synthesize"
    )

    ai_request_timeout: float = 60.0

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()