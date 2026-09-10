from typing import List, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
)

from .common import ContextTags


# Baseline 문서에서 추출하는 Claim Type은
# Interview Knowledge Candidate/Knowledge Unit의 KnowledgeType과 분리한다.
#
# 상세설계 Step 0 BaselineClaim:
# PRINCIPLE / DECISION / EXCEPTION / OUTCOME
BaselineClaimType = Literal[
    "PRINCIPLE",
    "DECISION",
    "EXCEPTION",
    "OUTCOME",
]


class BaselineSource(BaseModel):
    model_config = ConfigDict(
        extra="forbid"
    )

    file_name: str
    page: int | None = None
    section: str | None = None


class BaselineClaimExtractionRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid"
    )

    schema_version: Literal["1.0"]
    chunk_id: UUID
    content: str
    source: BaselineSource
    context: ContextTags


class BaselineClaim(BaseModel):
    """
    Baseline 문서용 Atomic Claim.

    주의:
    claim_type은 Interview KnowledgeType과 다르다.
    Baseline에서는 아래 4종만 허용한다.
    - PRINCIPLE
    - DECISION
    - EXCEPTION
    - OUTCOME
    """
    model_config = ConfigDict(
        extra="forbid"
    )

    statement: str
    claim_type: BaselineClaimType
    context: ContextTags

    source_chunk_id: UUID
    source_text: str

    confidence_score: float = Field(
        ge=0.0,
        le=1.0,
    )


class BaselineClaimExtractionResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid"
    )

    schema_version: Literal["1.0"]
    chunk_id: UUID

    claims: List[BaselineClaim] = Field(
        default_factory=list
    )
