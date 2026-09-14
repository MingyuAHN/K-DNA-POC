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


# Conflict canonicalization은 DB history를 변경하지 않고
# Mission 조회 결과에서 반복 노출만 줄이는 presentation 정책이다.
#
# 동일 Interview / 동일 Conflict Type / 동일 semantic source 축을
# 전제로 Description까지 유사한 경우 같은 Conflict family로 본다.
#
# Evidence source는 Turn마다 retrieval 결과가 달라질 수 있으므로
# semantic source가 존재하는 cross-turn 비교에서는 exact equality를
# 강제하지 않는다. 대신 Description과 context_difference를 함께 본다.
DUPLICATE_DESCRIPTION_SIMILARITY = 0.72
EVIDENCE_ONLY_DESCRIPTION_SIMILARITY = 0.84
CONTEXT_DIFFERENCE_MIN_SIMILARITY = 0.45


# 실제 E2E에서 같은 본질의 Conflict가 Turn마다
# source 조합/description을 달리하며 반복되는 패턴이 확인되었다.
#
# 아래 semantic family는 확실한 subject/context 축이 잡히는 경우에만
# 기존 exact-source 정책보다 한 단계 넓게 canonicalize한다.
#
# 현재 PoC에서 strong family로 다루는 범위:
#   Database isolation 원칙
#   ↔ Migration / Incident 상황의 한시적 Shared Database 예외
#
# 다른 주제는 기존 보수적인 source/description 정책으로 fallback한다.
DATABASE_ISOLATION_FAMILY = "DATABASE_ISOLATION"


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
    analysis_id: str
    conflict_type: str
    severity: str
    description: str
    context_difference: str
    semantic_family: str | None

    semantic_source_keys: frozenset[str]
    evidence_source_keys: frozenset[str]


def _normalize_text(
    value: str | None,
) -> str:
    if not value:
        return ""

    normalized = value.lower()

    replacements = {
        r"shared\s+database": " shared_database ",
        r"shared\s+db": " shared_database ",
        r"database\s+per\s+service": " database_per_service ",
        r"migration": " migration ",
        r"마이그레이션": " migration ",
        r"독립적인\s+데이터베이스": " database_per_service ",
        r"독립\s+데이터베이스": " database_per_service ",
    }

    for pattern, replacement in replacements.items():
        normalized = re.sub(
            pattern,
            replacement,
            normalized,
            flags=re.IGNORECASE,
        )

    tokens = re.findall(
        r"[A-Za-z0-9가-힣_]+",
        normalized,
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



def _contains_any(
    text: str,
    values: Sequence[str],
) -> bool:
    return any(
        value in text
        for value in values
    )


def _conflict_context_family(
    text: str,
) -> str:
    """
    같은 Database isolation 주제라도 Migration 예외와
    장애/긴급 예외를 하나의 Conflict로 합치지 않기 위한 축.
    """

    if _contains_any(
        text,
        (
            "장애",
            "긴급",
            "incident",
            "emergency",
        ),
    ):
        return "INCIDENT"

    if _contains_any(
        text,
        (
            "migration",
            "전환",
            "레거시",
            "과도기",
            "초기 단계",
        ),
    ):
        return "MIGRATION"

    if _contains_any(
        text,
        (
            "평상시",
            "일반 운영",
            "정상 운영",
        ),
    ):
        return "NORMAL"

    return "GENERAL"


def _derive_semantic_family(
    description: str,
    context_difference: str | None,
    sources: Sequence[
        tuple[
            str,
            str | None,
            str,
        ]
    ],
) -> str | None:
    """
    Cross-turn family canonicalization용 strong semantic key.

    source_id exact set이 Turn마다 달라져도,
    모든 텍스트가 동일한 Database isolation 원칙과
    동일한 context의 한시적 예외를 다루면 같은 family로 본다.

    family를 확실히 만들 수 없는 Conflict는 None을 반환하여
    기존 strict source-set/description 정책으로 fallback한다.
    """

    source_text = " ".join(
        content
        for _, _, content in sources
        if content
    )

    text = _normalize_text(
        " ".join(
            value
            for value in (
                description,
                context_difference or "",
                source_text,
            )
            if value
        )
    )

    has_database_isolation_subject = (
        _contains_any(
            text,
            (
                "shared_database",
                "database_per_service",
            ),
        )
    )

    if not has_database_isolation_subject:
        return None

    has_exception_axis = _contains_any(
        text,
        (
            "예외",
            "허용",
            "유예",
            "연장",
            "한시",
            "임시",
            "유지할 수",
        ),
    )

    if not has_exception_axis:
        return None

    context_family = _conflict_context_family(
        text
    )

    # GENERAL까지 자동 family merge하면 unrelated DB Conflict가
    # 과도하게 합쳐질 수 있으므로 구체적 context가 있을 때만 사용한다.
    if context_family == "GENERAL":
        return None

    return (
        f"{DATABASE_ISOLATION_FAMILY}:"
        f"{context_family}:EXCEPTION"
    )


def _severity_rank(
    severity: str,
) -> int:
    ranks = {
        "LOW": 1,
        "MEDIUM": 2,
        "HIGH": 3,
        "CRITICAL": 4,
    }

    return ranks.get(
        (severity or "").upper(),
        0,
    )


def _family_representative_score(
    record: ConflictCanonicalizationRecord,
) -> tuple[int, int, int]:
    """
    같은 최신 Turn 안에 동일 family Conflict가 여러 개 있으면
    source가 가장 풍부한 Conflict를 대표값으로 선택한다.

    동일하면 severity, description 정보량 순으로 결정한다.
    """

    source_count = (
        len(record.semantic_source_keys)
        + len(record.evidence_source_keys)
    )

    return (
        source_count,
        _severity_rank(
            record.severity
        ),
        len(
            _normalize_text(
                record.description
            )
        ),
    )


def _select_family_representatives(
    records: Sequence[
        ConflictCanonicalizationRecord
    ],
) -> list[
    ConflictCanonicalizationRecord
]:
    """
    records는 최신 -> 과거 순서다.

    strong semantic family가 있는 경우:
    - 가장 최신 Analysis(Turn)를 family의 현재 대표 Turn으로 잡는다.
    - 그 Turn 안에서 source 정보가 가장 풍부한 Conflict 한 건을 남긴다.
    - 이전 Turn의 같은 family Conflict는 presentation에서 숨긴다.

    raw DB/history는 전혀 변경하지 않는다.
    """

    result: list[
        ConflictCanonicalizationRecord
    ] = []
    processed_family_keys: set[
        tuple[
            str,
            str,
            str,
        ]
    ] = set()

    for record in records:
        if record.semantic_family is None:
            result.append(
                record
            )
            continue

        family_key = (
            record.interview_id,
            record.conflict_type,
            record.semantic_family,
        )

        if family_key in processed_family_keys:
            continue

        processed_family_keys.add(
            family_key
        )

        latest_analysis_id = (
            record.analysis_id
        )

        # 단위 테스트/외부 호출처럼 analysis_id가 없는 Record는
        # 입력 순서(최신 -> 과거)를 신뢰하고 첫 Record 자체를
        # 대표값으로 사용한다.
        #
        # analysis_id가 없는 상태에서 모든 동일 family Record를
        # 한 Turn으로 간주해 정보량 max를 선택하면 과거 Record가
        # 최신 Record를 역전할 수 있다.
        if not latest_analysis_id:
            result.append(
                record
            )
            continue

        same_latest_turn_family = [
            candidate
            for candidate in records
            if (
                candidate.interview_id
                == record.interview_id
                and candidate.conflict_type
                == record.conflict_type
                and candidate.semantic_family
                == record.semantic_family
                and candidate.analysis_id
                == latest_analysis_id
            )
        ]

        if not same_latest_turn_family:
            result.append(
                record
            )
            continue

        representative = max(
            same_latest_turn_family,
            key=_family_representative_score,
        )

        result.append(
            representative
        )

    # 원래 최신순 순서를 최대한 유지한다.
    order = {
        record.conflict_id: index
        for index, record in enumerate(
            records
        )
    }

    result.sort(
        key=lambda item: order.get(
            item.conflict_id,
            len(order),
        )
    )

    return result

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
    context_difference: str | None = None,
    analysis_id: str | None = None,
    severity: str | None = None,
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

    semantic_family = (
        _derive_semantic_family(
            description=description,
            context_difference=(
                context_difference
            ),
            sources=sources,
        )
    )

    return ConflictCanonicalizationRecord(
        conflict_id=str(
            conflict_id
        ),
        interview_id=str(
            interview_id
        ),
        analysis_id=(
            str(analysis_id)
            if analysis_id is not None
            else ""
        ),
        conflict_type=(
            conflict_type
        ),
        severity=(
            severity or ""
        ),
        description=description,
        context_difference=(
            context_difference or ""
        ),
        semantic_family=(
            semantic_family
        ),
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


def _context_difference_compatible(
    left: ConflictCanonicalizationRecord,
    right: ConflictCanonicalizationRecord,
) -> bool:
    """
    같은 source 축이라도 적용 조건이 완전히 다른 Conflict를
    하나로 합치지 않기 위한 guard.

    둘 중 한쪽에 context_difference가 없으면 Description + Source
    신호만 사용한다. 양쪽 모두 값이 있으면 최소 유사도를 요구한다.
    """

    left_context = _normalize_text(
        left.context_difference
    )
    right_context = _normalize_text(
        right.context_difference
    )

    if not left_context or not right_context:
        return True

    similarity = _description_similarity(
        left.context_difference,
        right.context_difference,
    )

    return (
        similarity
        >= CONTEXT_DIFFERENCE_MIN_SIMILARITY
    )


def _is_semantic_duplicate(
    left: ConflictCanonicalizationRecord,
    right: ConflictCanonicalizationRecord,
) -> bool:
    """
    Mission 화면의 cross-turn 반복 Conflict를 보수적으로 축약한다.

    동일 Interview / 동일 Conflict Type은 필수다.

    semantic source(BASELINE_CLAIM / KNOWLEDGE_UNIT 등)가 있는 경우:
    - semantic source set이 정확히 같아야 한다.
    - Evidence retrieval source는 Turn마다 달라도 허용한다.
    - Description이 충분히 유사해야 한다.
    - 양쪽 context_difference가 있으면 서로 호환되어야 한다.

    semantic source가 전혀 없고 Evidence만 있는 경우:
    - 기존 정책처럼 Evidence source set exact match를 요구한다.
    - 더 높은 Description threshold를 유지한다.

    따라서 같은 Baseline 원칙을 두고 Turn마다 다른 Document Chunk가
    근거로 붙은 반복 Conflict는 최신 1건으로 줄일 수 있지만,
    source 축 자체가 다른 atomic issue는 합치지 않는다.
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

    if not _context_difference_compatible(
        left,
        right,
    ):
        return False

    if (
        left.semantic_source_keys
        or right.semantic_source_keys
    ):
        if (
            not left.semantic_source_keys
            or not right.semantic_source_keys
        ):
            return False

        if (
            left.semantic_source_keys
            != right.semantic_source_keys
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

    if (
        not left.evidence_source_keys
        or not right.evidence_source_keys
    ):
        return False

    if (
        left.evidence_source_keys
        != right.evidence_source_keys
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
        >= EVIDENCE_ONLY_DESCRIPTION_SIMILARITY
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
    같은 Interview에서 동일 semantic source 축을 갖는
    유사 Conflict는 Evidence source가 Turn마다 달라도
    최신 Conflict 하나만 노출한다.

    서로 다른 Interview 간에는 dedupe하지 않는다.

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

    # -----------------------------------------------------
    # 0. Strong cross-turn semantic family canonicalization
    #
    # E2E에서 같은 Database isolation conflict가
    # Turn마다 다른 source 조합/문장으로 반복되는 패턴을 먼저 축약한다.
    # family를 만들 수 없는 Conflict는 그대로 다음 strict 단계로 넘긴다.
    # -----------------------------------------------------
    family_records = (
        _select_family_representatives(
            records
        )
    )

    deduplicated_records: list[
        ConflictCanonicalizationRecord
    ] = []

    # -----------------------------------------------------
    # 1. 동일 Conflict 반복 탐지
    #
    # records가 최신순이므로 먼저 등장한 row가
    # 최신 Conflict다.
    # -----------------------------------------------------
    for record in family_records:
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