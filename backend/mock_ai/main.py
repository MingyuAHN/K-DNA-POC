from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field


app = FastAPI(
    title="K-DNA Mock AI",
    version="0.1.0",
)


# ============================================================
# Common
# ============================================================


EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSION = 1536


def create_mock_vector() -> list[float]:
    """
    E2E 연결 테스트용 고정 Embedding.

    모든 문서/Query가 같은 방향의 벡터를 사용하므로
    실제 의미 검색 품질 테스트 용도가 아니라
    pgvector 저장/검색 파이프라인 검증 용도이다.
    """

    return [
        1.0,
        *([0.0] * (EMBEDDING_DIMENSION - 1)),
    ]


def build_context(
    domain: str | None = "MSA",
    phase: str | None = "Migration Phase 1",
) -> dict[str, Any]:
    return {
        "project": "Project Alpha",
        "phase": phase,
        "domain": domain,
        "system": "Database",
        "scope": "Migration",
        "time": None,
        "constraints": [],
        "tags": [
            "Database per Service",
            "Migration",
        ],
    }


# ============================================================
# Health
# ============================================================


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "k-dna-mock-ai",
    }


# ============================================================
# Embedding
#
# POST /api/v1/ai/embeddings
# ============================================================


class EmbeddingItem(BaseModel):
    item_id: str
    item_type: str
    text: str


class EmbeddingRequest(BaseModel):
    items: list[EmbeddingItem]


@app.post("/api/v1/ai/embeddings")
def create_embeddings(
    request: EmbeddingRequest,
):
    return {
        "model": EMBEDDING_MODEL,
        "dimension": EMBEDDING_DIMENSION,
        "embeddings": [
            {
                "item_id": item.item_id,
                "item_type": item.item_type,
                "vector": create_mock_vector(),
            }
            for item in request.items
        ],
    }


# ============================================================
# Baseline Claim Extraction
#
# POST /api/v1/ai/baseline-claims/extract
# ============================================================


class BaselineClaimSource(BaseModel):
    file_name: str
    page: int | None = None
    section: str | None = None


class BaselineClaimRequest(BaseModel):
    schema_version: str = "1.0"
    chunk_id: str
    content: str
    source: BaselineClaimSource
    context: dict[str, Any] = Field(
        default_factory=dict
    )


@app.post(
    "/api/v1/ai/baseline-claims/extract"
)
def extract_baseline_claims(
    request: BaselineClaimRequest,
):
    content = request.content.strip()

    claims = []

    if "Shared DB" in content:
        claims.append(
            {
                "statement": (
                    "Migration 초기에는 "
                    "Shared DB를 허용할 수 있다."
                ),
                "claim_type": "EXCEPTION",
                "context": {
                    "domain": "MSA",
                    "phase": "Migration",
                },
                "source_chunk_id": (
                    request.chunk_id
                ),
                "source_text": content,
                "confidence_score": 0.95,
            }
        )

    if (
        "Database per Service" in content
        or not claims
    ):
        claims.append(
            {
                "statement": (
                    "Database per Service를 "
                    "기본 원칙으로 한다."
                ),
                "claim_type": "PRINCIPLE",
                "context": {
                    "domain": "MSA",
                },
                "source_chunk_id": (
                    request.chunk_id
                ),
                "source_text": content,
                "confidence_score": 0.98,
            }
        )

    return {
        "schema_version": "1.0",
        "chunk_id": request.chunk_id,
        "claims": claims,
    }


# ============================================================
# Interview Analyze
#
# POST /api/v1/ai/interviews/analyze
# ============================================================


class InterviewAnalyzeRequest(BaseModel):
    mission: dict[str, Any]
    interview: dict[str, Any]
    message: dict[str, Any]

    conversation_context: list[
        dict[str, Any]
    ] = Field(default_factory=list)

    retrieved_knowledge: list[
        dict[str, Any]
    ] = Field(default_factory=list)

    retrieved_evidence: list[
        dict[str, Any]
    ] = Field(default_factory=list)


def make_question(
    question: str,
    question_type: str,
    target_gap: str,
    value_score: float = 0.9,
) -> dict[str, Any]:

    return {
        "question": question,
        "question_type": question_type,
        "target_gap": target_gap,
        "gap_reduction_score": 0.95,
        "novelty_score": 0.90,
        "business_impact_score": 0.90,
        "conflict_resolution_score": 0.95,
        "redundancy_score": 0.0,
        "value_score": value_score,
    }


@app.post(
    "/api/v1/ai/interviews/analyze"
)
def analyze_interview(
    request: InterviewAnalyzeRequest,
):
    message_content = str(
        request.message.get(
            "content",
            "",
        )
    ).strip()

    content_lower = message_content.lower()

    # --------------------------------------------------------
    # Case 3
    # 충분한 종료 조건까지 답변한 경우
    # next_question = null 테스트
    # --------------------------------------------------------
    if (
        "phase 2" in content_lower
        or "2단계" in message_content
        or "분리 완료" in message_content
    ):
        candidate = {
            "statement": (
                "Migration Phase 1에서는 "
                "Shared DB를 한시적으로 허용하고, "
                "Phase 2 이전에는 서비스별 "
                "물리 DB 분리를 완료한다."
            ),
            "type": "DECISION_RULE",
            "context": build_context(),
            "decision_rule": {
                "if_conditions": [
                    "Migration Phase 1이다",
                ],
                "then": (
                    "Shared DB를 한시적으로 "
                    "사용할 수 있다."
                ),
                "unless": [
                    (
                        "서비스 간 데이터 소유권 "
                        "충돌이 발생한다"
                    ),
                ],
            },
            "rationale": (
                "초기 Migration 위험을 "
                "감소시키기 위한 단계적 전략이다."
            ),
            "exception": (
                "Phase 2 이전까지로 제한한다."
            ),
            "novelty_score": 0.95,
            "confidence_score": 0.98,
            "validation_status": "CANDIDATE",
        }

        return {
            "knowledge_candidates": [
                candidate
            ],
            "gaps": [],
            "conflicts": [],
            "question_candidates": [],
            "next_question": None,
        }

    # --------------------------------------------------------
    # Case 2
    # Transaction Coupling에 답한 경우
    # --------------------------------------------------------
    if (
        "transaction coupling"
        in content_lower
        or "커플링" in message_content
        or "coupling" in content_lower
    ):
        candidate = {
            "statement": (
                "Transaction Coupling이 높아 "
                "Migration 초기에는 물리 DB "
                "분리를 유예할 수 있다."
            ),
            "type": "DECISION_RULE",
            "context": {
                **build_context(
                    domain="Data Ownership"
                ),
                "constraints": [
                    "High Transaction Coupling"
                ],
                "tags": [
                    "Transaction Coupling",
                    "Logical Separation",
                ],
            },
            "decision_rule": {
                "if_conditions": [
                    "Migration 초기 단계",
                    (
                        "Transaction Coupling이 "
                        "높음"
                    ),
                ],
                "then": (
                    "물리 DB 분리를 유예하고 "
                    "Logical Separation을 "
                    "우선 적용할 수 있다."
                ),
                "unless": [],
            },
            "rationale": (
                "높은 Transaction Coupling으로 "
                "즉시 물리 분리가 어렵다."
            ),
            "exception": (
                "Migration 초기 단계에 한정"
            ),
            "novelty_score": 0.92,
            "confidence_score": 0.96,
            "validation_status": "CANDIDATE",
        }

        gap = {
            "topic": "적용 종료 시점",
            "dimension": "WHEN",
            "gap_type": "MISSING_BOUNDARY",
            "gap_score": 0.90,
            "reason": (
                "Shared DB를 언제까지 "
                "사용할 수 있는지가 "
                "명확하지 않다."
            ),
        }

        conflict = {
            "conflict_type": (
                "CONDITIONAL_CONFLICT"
            ),
            "severity": "MEDIUM",
            "description": (
                "Database per Service 원칙과 "
                "Migration 초기 Shared DB "
                "사용 사이에 조건부 차이가 있다."
            ),
            "sources": [
                {
                    "source_type": (
                        "Knowledge Candidate"
                    ),
                    "source_id": "mock-candidate",
                    "content": (
                        candidate["statement"]
                    ),
                }
            ],
            "context_difference": (
                "일반 운영 원칙과 Migration "
                "초기 단계의 차이"
            ),
            "unknown_condition": (
                "Shared DB 허용 종료 시점"
            ),
            "recommended_question": (
                "Shared DB를 어느 시점까지 "
                "허용했나요?"
            ),
        }

        next_question = make_question(
            question=(
                "Shared DB 사용은 어느 "
                "시점까지 허용했고, "
                "언제 서비스별 물리 DB "
                "분리를 완료했나요?"
            ),
            question_type="BOUNDARY_PROBE",
            target_gap="Shared DB 허용 종료 시점",
            value_score=0.94,
        )

        return {
            "knowledge_candidates": [
                candidate
            ],
            "gaps": [
                gap
            ],
            "conflicts": [
                conflict
            ],
            "question_candidates": [
                next_question
            ],
            "next_question": (
                next_question
            ),
        }

    # --------------------------------------------------------
    # Case 1
    # 첫 Expert 답변
    # --------------------------------------------------------
    candidate = {
        "statement": (
            "Migration 초기에는 Shared DB를 "
            "사용할 수 있다."
        ),
        "type": "EXCEPTION",
        "context": build_context(),
        "decision_rule": None,
        "rationale": None,
        "exception": (
            "Migration 초기 단계에 한정"
        ),
        "novelty_score": 0.85,
        "confidence_score": 0.94,
        "validation_status": "CANDIDATE",
    }

    gap = {
        "topic": "Shared DB 허용 조건",
        "dimension": "WHY",
        "gap_type": "MISSING_RATIONALE",
        "gap_score": 0.95,
        "reason": (
            "Shared DB 사용 이유와 "
            "구체적인 허용 조건이 "
            "확인되지 않았다."
        ),
    }

    conflict = {
        "conflict_type": (
            "CONDITIONAL_CONFLICT"
        ),
        "severity": "HIGH",
        "description": (
            "Database per Service 원칙과 "
            "Migration 초기 Shared DB 사용 "
            "사이에 조건부 차이가 있다."
        ),
        "sources": [
            {
                "source_type": (
                    "Knowledge Candidate"
                ),
                "source_id": "mock-candidate",
                "content": (
                    candidate["statement"]
                ),
            }
        ],
        "context_difference": (
            "일반 MSA 운영 원칙과 "
            "Migration 초기 단계의 차이"
        ),
        "unknown_condition": (
            "Shared DB를 허용하는 "
            "구체적인 조건"
        ),
        "recommended_question": (
            "Shared DB를 허용했던 "
            "구체적인 조건은 무엇인가요?"
        ),
    }

    next_question = make_question(
        question=(
            "Migration 초기 Shared DB를 "
            "허용했던 구체적인 이유나 "
            "조건은 무엇이었나요?"
        ),
        question_type="CONFLICT_RESOLUTION",
        target_gap="Shared DB 허용 조건",
        value_score=0.96,
    )

    return {
        "knowledge_candidates": [
            candidate
        ],
        "gaps": [
            gap
        ],
        "conflicts": [
            conflict
        ],
        "question_candidates": [
            next_question
        ],
        "next_question": (
            next_question
        ),
    }


# ============================================================
# Knowledge Synthesis
#
# POST /api/v1/ai/knowledge/synthesize
# ============================================================


class KnowledgeSynthesisRequest(BaseModel):
    candidate: dict[str, Any]

    existing_knowledge: list[
        dict[str, Any]
    ] = Field(default_factory=list)


@app.post(
    "/api/v1/ai/knowledge/synthesize"
)
def synthesize_knowledge(
    request: KnowledgeSynthesisRequest,
):
    candidate = request.candidate

    existing = request.existing_knowledge

    candidate_statement = str(
        candidate.get(
            "statement",
            "",
        )
    )

    candidate_context = (
        candidate.get("context") or {}
    )

    # --------------------------------------------------------
    # 기존 Knowledge가 없을 경우
    # --------------------------------------------------------
    if not existing:
        synthesized = {
            "statement": (
                candidate_statement
            ),
            "type": candidate.get(
                "type",
                "EXPERT_OPINION",
            ),
            "context": (
                candidate_context
            ),
            "decision_rule": (
                candidate.get(
                    "decision_rule"
                )
            ),
            "rationale": (
                candidate.get(
                    "rationale"
                )
            ),
            "exception": (
                candidate.get(
                    "exception"
                )
            ),
            "novelty_score": float(
                candidate.get(
                    "novelty_score",
                    0.8,
                )
            ),
            "confidence_score": float(
                candidate.get(
                    "confidence_score",
                    0.9,
                )
            ),
            "validation_status": (
                "CANDIDATE"
            ),
        }

        return {
            "operation": "KEEP_CONFLICT",
            "target_knowledge_ids": [],
            "synthesized_knowledge_units": [
                synthesized
            ],
            "relations": [],
            "reason": (
                "비교할 기존 Knowledge가 "
                "없어 신규 Knowledge Proposal로 "
                "유지한다."
            ),
        }

    # --------------------------------------------------------
    # 기존 Knowledge가 존재하면 첫 Knowledge를 Target으로
    # ADD_EXCEPTION 테스트
    # --------------------------------------------------------
    target = existing[0]

    target_id = str(
        target.get("knowledge_id")
    )

    target_statement = str(
        target.get(
            "statement",
            "",
        )
    )

    synthesized = {
        "statement": (
            f"{target_statement} "
            "단, Migration 초기 "
            "Transaction Coupling이 높은 경우 "
            "물리적 DB 분리를 유예하고 "
            "Logical Separation을 우선 "
            "적용할 수 있다."
        ),
        "type": "DECISION_RULE",
        "context": {
            "project": (
                candidate_context.get(
                    "project"
                )
            ),
            "phase": (
                candidate_context.get(
                    "phase",
                    "Migration Phase 1",
                )
            ),
            "domain": (
                candidate_context.get(
                    "domain",
                    "Data Ownership",
                )
            ),
            "system": (
                candidate_context.get(
                    "system"
                )
            ),
            "scope": (
                candidate_context.get(
                    "scope"
                )
            ),
            "time": (
                candidate_context.get(
                    "time"
                )
            ),
            "constraints": [
                "High Transaction Coupling"
            ],
            "tags": [
                "Database per Service",
                "Logical Separation",
            ],
        },
        "decision_rule": {
            "if_conditions": [
                "Migration 초기 단계",
                (
                    "Transaction Coupling이 "
                    "높음"
                ),
            ],
            "then": (
                "물리적 데이터베이스 분리를 "
                "유예하고 Logical Separation을 "
                "우선 적용할 수 있다."
            ),
            "unless": [],
        },
        "rationale": (
            "Transaction Coupling이 높은 "
            "초기 단계에서는 즉시 물리적 "
            "분리가 어려울 수 있다."
        ),
        "exception": (
            "Migration 초기 "
            "High Transaction Coupling 상황"
        ),
        "novelty_score": 0.90,
        "confidence_score": 0.93,
        "validation_status": "CANDIDATE",
    }

    return {
        "operation": "ADD_EXCEPTION",

        # 중요:
        # Backend가 넘긴 UUID 그대로 반환
        "target_knowledge_ids": [
            target_id
        ],

        "synthesized_knowledge_units": [
            synthesized
        ],

        "relations": [
            {
                "synthesized_index": 0,
                "target_knowledge_id": (
                    target_id
                ),
                "relation": (
                    "HAS_EXCEPTION"
                ),
                "reason": (
                    "기존 DB 분리 원칙에 "
                    "Migration 초기의 조건부 "
                    "예외가 추가되었다."
                ),
            }
        ],

        "reason": (
            "새 Candidate가 기존 원칙을 "
            "폐기하지 않고 조건부 예외를 "
            "추가하므로 ADD_EXCEPTION으로 "
            "판단했다."
        ),
    }