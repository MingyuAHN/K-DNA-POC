import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Sequence


# Mission Gap 화면에서만 사용하는 presentation canonicalization.
#
# 저장된 KnowledgeGap row / InterviewAnalysis.raw_response는 변경하지 않는다.
#
# 1차: 기존처럼 같은 dimension/gap_type 안에서 표현이 매우 유사한 Gap을
#      최신 row 하나로 축약한다.
# 2차: 실제 E2E에서 확인된 cross-turn "같은 문제의 발전형"을
#      semantic family로 묶는다.
#
# semantic family는 확실한 subject/context/issue 축이 잡힐 때만 사용한다.
# 분류가 애매한 Gap은 기존 strict 정책만 적용하여 과병합을 피한다.
GAP_TOPIC_SEQUENCE_SIMILARITY = 0.82
GAP_TOPIC_NGRAM_CONTAINMENT = 0.78
GAP_SUPPORTING_TOPIC_NGRAM_CONTAINMENT = 0.55
GAP_REASON_SEQUENCE_SIMILARITY = 0.78
GAP_REASON_NGRAM_CONTAINMENT = 0.76
GAP_CHAR_NGRAM_SIZE = 3


@dataclass(frozen=True)
class GapCanonicalizationRecord:
    """
    Mission Gap 화면에서 반복 Gap 노출 여부를 판단하기 위한
    Backend 내부 DTO.

    DB row는 삭제/수정하지 않는다.
    입력 순서는 최신 Gap -> 과거 Gap을 전제로 한다.
    """

    gap_id: str
    interview_id: str
    dimension: str
    gap_type: str
    topic: str
    reason: str


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
        r"기존\s+가이드": " baseline_policy ",
        r"기존\s+원칙": " baseline_policy ",
        r"기존\s+지식": " baseline_policy ",
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


def _char_ngrams(
    value: str | None,
    size: int = GAP_CHAR_NGRAM_SIZE,
) -> set[str]:
    normalized = _normalize_text(value).replace(
        " ",
        "",
    )

    if not normalized:
        return set()

    if len(normalized) <= size:
        return {normalized}

    return {
        normalized[index:index + size]
        for index in range(
            len(normalized) - size + 1
        )
    }


def _sequence_similarity(
    left: str | None,
    right: str | None,
) -> float:
    left_normalized = _normalize_text(left)
    right_normalized = _normalize_text(right)

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


def _ngram_containment(
    left: str | None,
    right: str | None,
) -> float:
    left_ngrams = _char_ngrams(left)
    right_ngrams = _char_ngrams(right)

    if not left_ngrams or not right_ngrams:
        return 0.0

    intersection = (
        left_ngrams
        & right_ngrams
    )

    return (
        len(intersection)
        / min(
            len(left_ngrams),
            len(right_ngrams),
        )
    )


def _contains_any(
    text: str,
    values: Sequence[str],
) -> bool:
    return any(
        value in text
        for value in values
    )


def _subject_family(
    text: str,
    issue: str | None,
) -> str | None:
    """
    strong family subject.

    POLICY_RELATION은 Database isolation 축을 명시적으로 요구한다.

    기간/연장/만료 lifecycle Gap은 개별 Topic에 Shared Database라는
    단어가 생략되는 Turn이 많다. 이 경우 같은 Interview 안에서
    "예외/연장/전환/기간" 신호가 함께 있으면 EXCEPTION_LIFECYCLE로
    묶어 cross-turn 발전형을 인식한다.
    """

    has_database_isolation = _contains_any(
        text,
        (
            "shared_database",
            "database_per_service",
            "독립적인 데이터베이스",
            "독립 데이터베이스",
        ),
    )

    if issue == "POLICY_RELATION":
        if has_database_isolation:
            return "DATABASE_ISOLATION"

        return None

    if issue in {
        "POST_LIMIT_ACTION",
        "EXTENSION_GOVERNANCE",
        "DURATION_DEFINITION",
        "EXCEPTION_SCOPE",
    }:
        has_exception_lifecycle = _contains_any(
            text,
            (
                "예외",
                "연장",
                "기간",
                "기한",
                "6개월",
                "9개월",
                "전환",
                "migration",
            ),
        )

        if has_exception_lifecycle:
            return "EXCEPTION_LIFECYCLE"

    if has_database_isolation:
        return "DATABASE_ISOLATION"

    return None


def _context_family(
    text: str,
) -> str:
    """
    같은 DB 주제라도 Migration 예외와 장애 대응 예외를
    하나로 합치지 않기 위한 context axis.
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
            "초기 단계",
            "과도기",
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


def _gap_issue_family(
    record: GapCanonicalizationRecord,
    text: str,
) -> str | None:
    """
    Topic 문자열이 달라도 실제 질문의 본질이 같은 경우를
    제한적으로 같은 family로 분류한다.

    우선순위:
    1. 원칙/예외 관계
    2. 최대 기간 이후 후속 조치
    3. 연장 승인/조건
    4. 기간 산정

    이 순서로 분류해 "6개월" 같은 숫자가 포함됐다는 이유만으로
    policy relation Gap을 duration Gap으로 오분류하지 않는다.
    """

    gap_type = _normalize_text(
        record.gap_type
    )

    if (
        gap_type == "conflict"
        and _contains_any(
            text,
            (
                "원칙",
                "baseline_policy",
                "가이드",
                "우선순위",
                "관계",
                "적용 범위",
                "차이",
                "충돌",
            ),
        )
        and _contains_any(
            text,
            (
                "예외",
                "허용",
                "shared_database",
                "database_per_service",
            ),
        )
    ):
        return "POLICY_RELATION"

    post_limit_signal = (
        _contains_any(
            text,
            (
                "9개월 이후",
                "3개월 연장 후",
                "6개월 이후",
                "기한 이후",
                "예외 만료",
                "기간 만료",
                "미완료",
                "완료되지",
            ),
        )
        and _contains_any(
            text,
            (
                "처리",
                "조치",
                "전환",
                "추가 연장",
                "강제",
                "에스컬레이션",
                "위험 수용",
                "운영 절차",
            ),
        )
    )

    if post_limit_signal:
        return "POST_LIMIT_ACTION"

    extension_governance = (
        _contains_any(
            text,
            (
                "연장",
                "재연장",
            ),
        )
        and _contains_any(
            text,
            (
                "조건",
                "승인",
                "책임자",
                "데이터 손실",
                "서비스 중단",
                "위험 판단",
                "판정 기준",
                "승인 기준",
            ),
        )
    )

    if extension_governance:
        return "EXTENSION_GOVERNANCE"

    duration_definition = (
        _contains_any(
            text,
            (
                "기간",
                "시간 기준",
                "산정",
                "6개월",
                "9개월",
                "총 허용",
            ),
        )
        and not _contains_any(
            text,
            (
                "근거",
                "왜 ",
            ),
        )
    )

    if duration_definition:
        return "DURATION_DEFINITION"

    exception_scope = (
        _normalize_text(
            record.gap_type
        )
        == "missing_exception"
        and _contains_any(
            text,
            (
                "예외",
                "허용",
            ),
        )
        and _contains_any(
            text,
            (
                "조건",
                "적용",
                "범위",
                "존재 여부",
            ),
        )
        and not _contains_any(
            text,
            (
                "연장",
                "재연장",
            ),
        )
    )

    if exception_scope:
        return "EXCEPTION_SCOPE"

    return None


def _semantic_family_key(
    record: GapCanonicalizationRecord,
) -> tuple[str, str, str, str] | None:
    text = _normalize_text(
        f"{record.topic} {record.reason}"
    )

    issue = _gap_issue_family(
        record=record,
        text=text,
    )

    if issue is None:
        return None

    subject = _subject_family(
        text=text,
        issue=issue,
    )

    if subject is None:
        return None

    context = _context_family(
        text
    )

    return (
        record.interview_id,
        subject,
        context,
        issue,
    )


def build_gap_canonicalization_record(
    gap_id: str,
    interview_id: str,
    dimension: str,
    gap_type: str,
    topic: str,
    reason: str,
) -> GapCanonicalizationRecord:
    return GapCanonicalizationRecord(
        gap_id=str(gap_id),
        interview_id=str(interview_id),
        dimension=dimension,
        gap_type=gap_type,
        topic=topic,
        reason=reason,
    )


def _same_gap_scope(
    left: GapCanonicalizationRecord,
    right: GapCanonicalizationRecord,
) -> bool:
    """
    Strict duplicate 비교용 scope.

    기존 정책은 그대로 유지한다:
    같은 Interview + 같은 dimension + 같은 gap_type.
    """

    if (
        left.interview_id
        != right.interview_id
    ):
        return False

    if (
        _normalize_text(left.dimension)
        != _normalize_text(right.dimension)
    ):
        return False

    if (
        _normalize_text(left.gap_type)
        != _normalize_text(right.gap_type)
    ):
        return False

    return True


def _is_strict_gap_duplicate(
    left: GapCanonicalizationRecord,
    right: GapCanonicalizationRecord,
) -> bool:
    if not _same_gap_scope(
        left,
        right,
    ):
        return False

    left_topic = _normalize_text(
        left.topic
    )
    right_topic = _normalize_text(
        right.topic
    )

    if not left_topic or not right_topic:
        return False

    if left_topic == right_topic:
        return True

    topic_sequence = _sequence_similarity(
        left.topic,
        right.topic,
    )
    topic_ngram = _ngram_containment(
        left.topic,
        right.topic,
    )

    if (
        topic_sequence
        >= GAP_TOPIC_SEQUENCE_SIMILARITY
        or topic_ngram
        >= GAP_TOPIC_NGRAM_CONTAINMENT
    ):
        return True

    if (
        topic_ngram
        < GAP_SUPPORTING_TOPIC_NGRAM_CONTAINMENT
    ):
        return False

    reason_sequence = _sequence_similarity(
        left.reason,
        right.reason,
    )
    reason_ngram = _ngram_containment(
        left.reason,
        right.reason,
    )

    return (
        reason_sequence
        >= GAP_REASON_SEQUENCE_SIMILARITY
        or reason_ngram
        >= GAP_REASON_NGRAM_CONTAINMENT
    )


def _explicit_contexts_conflict(
    left: GapCanonicalizationRecord,
    right: GapCanonicalizationRecord,
) -> bool:
    """
    Topic이 동일하더라도 reason에 명시된 적용 Context가
    Migration / Incident / Normal처럼 서로 다르면 같은 Gap으로
    축약하지 않는다.

    GENERAL은 아직 Context가 구체화되지 않은 상태일 수 있으므로
    wildcard로 취급한다.
    """

    left_text = _normalize_text(
        f"{left.topic} {left.reason}"
    )
    right_text = _normalize_text(
        f"{right.topic} {right.reason}"
    )

    left_context = _context_family(
        left_text
    )
    right_context = _context_family(
        right_text
    )

    if (
        left_context == "GENERAL"
        or right_context == "GENERAL"
    ):
        return False

    return (
        left_context
        != right_context
    )


def _is_gap_duplicate(
    left: GapCanonicalizationRecord,
    right: GapCanonicalizationRecord,
) -> bool:
    """
    1) 동일 Interview라도 명시적 Context가 서로 다르면 merge하지 않는다.
    2) 기존 strict duplicate가 맞으면 merge.
    3) strict 기준을 넘지 못하더라도 strong semantic family key가
       완전히 같으면 같은 cross-turn Gap family로 본다.

    records가 최신순이므로 최신 row가 대표값으로 남는다.
    """

    if (
        left.interview_id
        != right.interview_id
    ):
        return False

    if _explicit_contexts_conflict(
        left,
        right,
    ):
        return False

    if _is_strict_gap_duplicate(
        left,
        right,
    ):
        return True

    left_family = _semantic_family_key(
        left
    )
    right_family = _semantic_family_key(
        right
    )

    if (
        left_family is None
        or right_family is None
    ):
        return False

    (
        left_interview,
        left_subject,
        left_context,
        left_issue,
    ) = left_family

    (
        right_interview,
        right_subject,
        right_context,
        right_issue,
    ) = right_family

    if (
        left_interview != right_interview
        or left_subject != right_subject
        or left_issue != right_issue
    ):
        return False

    if left_context == right_context:
        return True

    # 이전 Turn의 generic Gap은 context를 구체화하기 전일 수 있다.
    # GENERAL은 wildcard처럼 취급하되 INCIDENT와 NORMAL처럼
    # 명시적으로 다른 context끼리는 절대 합치지 않는다.
    return (
        left_context == "GENERAL"
        or right_context == "GENERAL"
    )


def select_visible_gap_ids(
    records: Sequence[
        GapCanonicalizationRecord
    ],
) -> set[str]:
    """
    Mission Gap 화면에서 노출할 Gap ID를 선택한다.

    중요:
    - DB KnowledgeGap row를 삭제/수정하지 않는다.
    - InterviewAnalysis.raw_response도 그대로 보존한다.
    - 입력은 최신 Gap -> 과거 Gap 순서여야 한다.
    - strict duplicate + strong semantic family에 대해서만
      최신 1건으로 축약한다.
    - 서로 다른 Interview는 합치지 않는다.
    - family를 확실히 만들 수 없는 Gap은 합치지 않는다.
    """

    canonical_records: list[
        GapCanonicalizationRecord
    ] = []

    for record in records:
        is_duplicate = any(
            _is_gap_duplicate(
                existing,
                record,
            )
            for existing
            in canonical_records
        )

        if is_duplicate:
            continue

        canonical_records.append(
            record
        )

    return {
        record.gap_id
        for record
        in canonical_records
    }
