import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any, Sequence

from app.schemas.interview_orchestration import (
    InterviewOrchestrationResponse,
)


BASELINE_CLAIM_SOURCE_TYPE = (
    "BASELINE_CLAIM"
)

KNOWLEDGE_UNIT_SOURCE_TYPE = (
    "KNOWLEDGE_UNIT"
)

EVIDENCE_SOURCE_TYPE = (
    "EVIDENCE"
)

UNKNOWN_SOURCE_TYPE = (
    "UNKNOWN"
)


# 동일 Source 집합에서 Description까지
# 상당히 유사한 경우에만 반복 Conflict로 본다.
#
# 단순히 Source가 같다는 이유만으로
# 서로 다른 atomic issue를 합치지 않는다.
DUPLICATE_DESCRIPTION_SIMILARITY = 0.84


@dataclass(frozen=True)
class ConflictCanonicalizationRecord:
    """
    Mission Conflict 화면에서
    Conflict 중복/복합 여부를 판단하기 위한
    Backend 내부 DTO.

    DB row를 삭제하거나 변경하지 않는다.
    Presentation 단계에서 어떤 Conflict를
    노출할지만 결정한다.
    """

    conflict_id: str
    interview_id: str
    conflict_type: str
    description: str

    semantic_source_keys: frozenset[str]
    evidence_source_keys: frozenset[str]


def _normalize_text(
    value: str | None,
) -> str:
    if not value:
        return ""

    tokens = re.findall(
        r"[A-Za-z0-9가-힣_]+",
        value.lower(),
    )

    return " ".join(tokens)


def _normalize_source_type_label(
    source_type: str | None,
) -> str:
    """
    이미 정규화된 Source Type 또는
    AI가 사용하는 Source Type 문자열을
    Backend 표준 형식으로 정리한다.

    주의:
    단순 "Knowledge"는
    BASELINE_CLAIM인지 KNOWLEDGE_UNIT인지
    문자열만으로 구분할 수 없다.

    따라서 이 함수에서는 KNOWLEDGE로 남기고,
    실제 provenance 판별은 source_id와
    request_context를 이용해서 수행한다.
    """

    if not source_type:
        return UNKNOWN_SOURCE_TYPE

    normalized = re.sub(
        r"[^A-Za-z0-9]+",
        "_",
        source_type.strip().upper(),
    ).strip("_")

    aliases = {
        "BASELINE_CLAIM": (
            BASELINE_CLAIM_SOURCE_TYPE
        ),
        "BASELINECLAIM": (
            BASELINE_CLAIM_SOURCE_TYPE
        ),
        "BASELINE_KNOWLEDGE": (
            BASELINE_CLAIM_SOURCE_TYPE
        ),
        "KNOWLEDGE_UNIT": (
            KNOWLEDGE_UNIT_SOURCE_TYPE
        ),
        "KNOWLEDGEUNIT": (
            KNOWLEDGE_UNIT_SOURCE_TYPE
        ),
        "EVIDENCE": (
            EVIDENCE_SOURCE_TYPE
        ),
        "DOCUMENT_CHUNK": (
            EVIDENCE_SOURCE_TYPE
        ),
        "CHUNK": (
            EVIDENCE_SOURCE_TYPE
        ),
    }

    return aliases.get(
        normalized,
        normalized or UNKNOWN_SOURCE_TYPE,
    )


def _collect_context_ids(
    request_context: dict[str, Any] | None,
    collection_key: str,
    id_key: str,
) -> set[str]:
    if not request_context:
        return set()

    items = (
        request_context.get(
            collection_key
        )
        or []
    )

    result: set[str] = set()

    for item in items:
        if not isinstance(
            item,
            dict,
        ):
            continue

        value = item.get(
            id_key
        )

        if value is None:
            continue

        normalized = str(
            value
        ).strip()

        if normalized:
            result.add(
                normalized
            )

    return result


def resolve_conflict_source_type(
    source_type: str | None,
    source_id: str | None,
    request_context: dict[str, Any] | None,
) -> str:
    """
    Conflict Source provenance를
    Backend가 실제 retrieval context 기준으로
    판별한다.

    우선순위:

    retrieved_knowledge[].claim_id
        → BASELINE_CLAIM

    retrieved_knowledge_units[].knowledge_id
        → KNOWLEDGE_UNIT

    retrieved_evidence[].chunk_id
        → EVIDENCE

    ID가 Context에서 발견되지 않을 때만
    기존 source_type 문자열을 fallback으로 사용한다.
    """

    normalized_source_id = (
        str(source_id).strip()
        if source_id is not None
        else ""
    )

    baseline_claim_ids = (
        _collect_context_ids(
            request_context=(
                request_context
            ),
            collection_key=(
                "retrieved_knowledge"
            ),
            id_key="claim_id",
        )
    )

    knowledge_unit_ids = (
        _collect_context_ids(
            request_context=(
                request_context
            ),
            collection_key=(
                "retrieved_knowledge_units"
            ),
            id_key="knowledge_id",
        )
    )

    evidence_ids = (
        _collect_context_ids(
            request_context=(
                request_context
            ),
            collection_key=(
                "retrieved_evidence"
            ),
            id_key="chunk_id",
        )
    )

    if normalized_source_id:
        if (
            normalized_source_id
            in baseline_claim_ids
        ):
            return (
                BASELINE_CLAIM_SOURCE_TYPE
            )

        if (
            normalized_source_id
            in knowledge_unit_ids
        ):
            return (
                KNOWLEDGE_UNIT_SOURCE_TYPE
            )

        if (
            normalized_source_id
            in evidence_ids
        ):
            return (
                EVIDENCE_SOURCE_TYPE
            )

    return _normalize_source_type_label(
        source_type
    )


def normalize_interview_conflict_sources(
    result: InterviewOrchestrationResponse,
    request_context: dict[str, Any],
) -> InterviewOrchestrationResponse:
    """
    /turns Frontend Response용.

    AI 원본 Pydantic 객체를 직접 mutate하지 않고
    복사본을 반환한다.

    raw_response는 별도로 AI 원본을 저장해야 하므로
    save_interview_analysis()에 이 반환값을 전달해서
    raw_response를 덮어쓰지 않는다.
    """

    normalized_conflicts = []

    for conflict in result.conflicts:
        normalized_sources = []

        for source in conflict.sources:
            normalized_sources.append(
                source.model_copy(
                    update={
                        "source_type": (
                            resolve_conflict_source_type(
                                source_type=(
                                    source.source_type
                                ),
                                source_id=(
                                    source.source_id
                                ),
                                request_context=(
                                    request_context
                                ),
                            )
                        )
                    }
                )
            )

        normalized_conflicts.append(
            conflict.model_copy(
                update={
                    "sources": (
                        normalized_sources
                    )
                }
            )
        )

    return result.model_copy(
        update={
            "conflicts": (
                normalized_conflicts
            )
        }
    )


def _build_source_key(
    source_type: str,
    source_id: str | None,
    content: str,
) -> str | None:
    normalized_type = (
        _normalize_source_type_label(
            source_type
        )
    )

    if source_id is not None:
        normalized_source_id = str(
            source_id
        ).strip()

        if normalized_source_id:
            return (
                f"{normalized_type}:"
                f"{normalized_source_id}"
            )

    normalized_content = (
        _normalize_text(
            content
        )
    )

    if normalized_content:
        return (
            f"{normalized_type}:"
            f"CONTENT:"
            f"{normalized_content}"
        )

    return None


def build_conflict_canonicalization_record(
    conflict_id: str,
    interview_id: str,
    conflict_type: str,
    description: str,
    sources: Sequence[
        tuple[
            str,
            str | None,
            str,
        ]
    ],
) -> ConflictCanonicalizationRecord:
    """
    Mission Conflict 조회용 Canonicalization Record 생성.

    sources:
        (
            source_type,
            source_id,
            content,
        )
    """

    semantic_source_keys: set[str] = set()
    evidence_source_keys: set[str] = set()

    for (
        source_type,
        source_id,
        content,
    ) in sources:
        normalized_type = (
            _normalize_source_type_label(
                source_type
            )
        )

        source_key = (
            _build_source_key(
                source_type=(
                    normalized_type
                ),
                source_id=(
                    source_id
                ),
                content=content,
            )
        )

        if source_key is None:
            continue

        if (
            normalized_type
            == EVIDENCE_SOURCE_TYPE
        ):
            evidence_source_keys.add(
                source_key
            )
        else:
            semantic_source_keys.add(
                source_key
            )

    return ConflictCanonicalizationRecord(
        conflict_id=str(
            conflict_id
        ),
        interview_id=str(
            interview_id
        ),
        conflict_type=(
            conflict_type
        ),
        description=description,
        semantic_source_keys=frozenset(
            semantic_source_keys
        ),
        evidence_source_keys=frozenset(
            evidence_source_keys
        ),
    )


def _description_similarity(
    left: str,
    right: str,
) -> float:
    left_normalized = (
        _normalize_text(
            left
        )
    )

    right_normalized = (
        _normalize_text(
            right
        )
    )

    if (
        not left_normalized
        or not right_normalized
    ):
        return 0.0

    return SequenceMatcher(
        None,
        left_normalized,
        right_normalized,
    ).ratio()


def _is_semantic_duplicate(
    left: ConflictCanonicalizationRecord,
    right: ConflictCanonicalizationRecord,
) -> bool:
    """
    동일 Interview / 동일 Conflict Type /
    동일 Source Set이면서 Description까지
    매우 유사한 경우에만 반복 Conflict로 처리한다.

    Source Set만 같고 Description이 다른
    atomic issue는 합치지 않는다.
    """

    if (
        left.interview_id
        != right.interview_id
    ):
        return False

    if (
        left.conflict_type
        != right.conflict_type
    ):
        return False

    if (
        left.semantic_source_keys
        != right.semantic_source_keys
    ):
        return False

    if (
        left.evidence_source_keys
        != right.evidence_source_keys
    ):
        return False

    if not (
        left.semantic_source_keys
        or left.evidence_source_keys
    ):
        return False

    similarity = (
        _description_similarity(
            left.description,
            right.description,
        )
    )

    return (
        similarity
        >= DUPLICATE_DESCRIPTION_SIMILARITY
    )


def _evidence_sets_compatible(
    composite: ConflictCanonicalizationRecord,
    atomic: ConflictCanonicalizationRecord,
) -> bool:
    """
    서로 다른 문서/Evidence에서 우연히 Source Set이
    겹치는 Conflict를 합치지 않기 위한 Guard.

    composite가 Evidence를 갖고 있다면
    atomic도 동일 Evidence Set을 가져야 한다.

    Evidence가 없다면 양쪽 모두 Evidence가 없는
    경우에만 허용한다.
    """

    if composite.evidence_source_keys:
        return (
            composite.evidence_source_keys
            == atomic.evidence_source_keys
        )

    return (
        not atomic.evidence_source_keys
    )


def select_visible_conflict_ids(
    records: Sequence[
        ConflictCanonicalizationRecord
    ],
) -> set[str]:
    """
    Mission Conflict 화면에서 노출할 Conflict ID를 선택한다.

    중요:
    DB Conflict를 삭제하지 않는다.
    Analysis provenance도 변경하지 않는다.

    입력 순서는 최신 Conflict → 과거 Conflict여야 한다.

    정책 1.
    동일 Source Set + 유사 Description의 반복 Conflict는
    최신 Conflict 하나만 노출한다.

    정책 2.
    하나의 Conflict Source Set이
    두 개 이상의 기존 atomic Conflict Source Set의
    정확한 합집합이면 해당 composite Conflict를
    화면에서 suppress한다.

    예:
        A = {공통원칙, 담당자원칙}
        B = {공통원칙, 기한원칙}
        C = {공통원칙, 담당자원칙, 기한원칙}

        A ∪ B == C

        → A, B 노출
        → C suppress

    서로 다른 Interview 간에는 dedupe하지 않는다.
    """

    deduplicated_records: list[
        ConflictCanonicalizationRecord
    ] = []

    # -----------------------------------------------------
    # 1. 동일 Conflict 반복 탐지
    #
    # records가 최신순이므로 먼저 등장한 row가
    # 최신 Conflict다.
    # -----------------------------------------------------
    for record in records:
        is_duplicate = any(
            _is_semantic_duplicate(
                existing,
                record,
            )
            for existing
            in deduplicated_records
        )

        if is_duplicate:
            continue

        deduplicated_records.append(
            record
        )

    visible_ids = {
        record.conflict_id
        for record
        in deduplicated_records
    }

    # -----------------------------------------------------
    # 2. Composite Conflict Suppression
    # -----------------------------------------------------
    for composite in deduplicated_records:
        if (
            len(
                composite
                .semantic_source_keys
            )
            < 2
        ):
            continue

        subset_records = []

        for candidate in deduplicated_records:
            if (
                candidate.conflict_id
                == composite.conflict_id
            ):
                continue

            if (
                candidate.interview_id
                != composite.interview_id
            ):
                continue

            if (
                candidate.conflict_type
                != composite.conflict_type
            ):
                continue

            if (
                not candidate
                .semantic_source_keys
            ):
                continue

            # strict subset
            if not (
                candidate
                .semantic_source_keys
                < composite
                .semantic_source_keys
            ):
                continue

            if not _evidence_sets_compatible(
                composite=composite,
                atomic=candidate,
            ):
                continue

            subset_records.append(
                candidate
            )

        unique_source_sets = {
            record.semantic_source_keys
            for record
            in subset_records
        }

        # 최소 2개의 서로 다른 atomic Conflict가
        # 있어야 composite로 판단한다.
        if (
            len(
                unique_source_sets
            )
            < 2
        ):
            continue

        union_sources: set[str] = set()

        for source_set in unique_source_sets:
            union_sources.update(
                source_set
            )

        if (
            frozenset(
                union_sources
            )
            == composite
            .semantic_source_keys
        ):
            visible_ids.discard(
                composite.conflict_id
            )

    return visible_ids