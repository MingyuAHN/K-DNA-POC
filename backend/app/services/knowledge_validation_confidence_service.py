from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from difflib import SequenceMatcher
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.interview import Interview
from app.models.interview_analysis import (
    InterviewAnalysis,
    KnowledgeCandidate,
)
from app.models.knowledge_core import Validation


VALIDATION_TYPE = "AUTO_CONFIDENCE"
VALIDATION_METHOD_VERSION = "POC_V1"
VALIDATED_BY = "K-DNA VALIDATION ENGINE"

VALIDATION_WEIGHTS: dict[str, float] = {
    "evidence_support": 0.25,
    "source_independence": 0.10,
    "cross_expert_agreement": 0.15,
    "context_completeness": 0.20,
    "exception_completeness": 0.10,
    "outcome_evidence": 0.15,
    "recency": 0.05,
}

SUPPORT_SOURCE_THRESHOLD = 0.20
NEUTRAL_SCORE = 0.50


@dataclass(frozen=True)
class ValidationConfidenceResult:
    confidence_score: float
    dimension_scores: dict[str, float]
    method_version: str = VALIDATION_METHOD_VERSION


@dataclass(frozen=True)
class _SupportSource:
    source_type: str
    source_id: str
    independence_key: str
    text: str


def _round_score(value: float) -> float:
    return round(max(0.0, min(1.0, float(value))), 4)


def _normalize_tokens(value: str | None) -> set[str]:
    if not value:
        return set()

    tokens = re.findall(
        r"[A-Za-z0-9가-힣_]+",
        value.lower(),
    )

    return {
        token
        for token in tokens
        if len(token) >= 2
    }


def _text_similarity(
    left: str | None,
    right: str | None,
) -> float:
    left_tokens = _normalize_tokens(left)
    right_tokens = _normalize_tokens(right)

    if not left_tokens or not right_tokens:
        return 0.0

    intersection = left_tokens & right_tokens
    union = left_tokens | right_tokens

    jaccard = (
        len(intersection) / len(union)
        if union
        else 0.0
    )

    # Candidate 문장이 더 긴 Evidence 안에 그대로 포함되는 경우를
    # 놓치지 않기 위해 candidate-side containment도 함께 본다.
    containment = (
        len(intersection) / len(left_tokens)
        if left_tokens
        else 0.0
    )

    left_compact = "".join(sorted(left_tokens))
    right_compact = "".join(sorted(right_tokens))
    sequence_ratio = SequenceMatcher(
        None,
        left_compact,
        right_compact,
    ).ratio()

    return _round_score(
        max(jaccard, containment, sequence_ratio)
    )


def _first_text(item: Any) -> str | None:
    if not isinstance(item, dict):
        return None

    for key in (
        "statement",
        "content",
        "source_text",
        "text",
    ):
        value = item.get(key)

        if isinstance(value, str) and value.strip():
            return value.strip()

    return None


def _first_id(item: Any, fallback: str) -> str:
    if not isinstance(item, dict):
        return fallback

    for key in (
        "message_id",
        "claim_id",
        "knowledge_id",
        "evidence_id",
        "chunk_id",
        "source_id",
        "item_id",
    ):
        value = item.get(key)

        if value is not None:
            return str(value)

    return fallback


def _collect_support_sources(
    request_context: dict[str, Any] | None,
) -> list[_SupportSource]:
    context = request_context or {}
    result: list[_SupportSource] = []
    seen: set[tuple[str, str, str]] = set()

    def add_source(
        source_type: str,
        item: Any,
        fallback_id: str,
        independence_key: str | None = None,
    ) -> None:
        text = _first_text(item)

        if text is None:
            return

        source_id = _first_id(item, fallback_id)
        resolved_independence_key = (
            independence_key
            or f"{source_type}:{source_id}"
        )
        key = (source_type, source_id, text)

        if key in seen:
            return

        seen.add(key)
        result.append(
            _SupportSource(
                source_type=source_type,
                source_id=source_id,
                independence_key=resolved_independence_key,
                text=text,
            )
        )

    interview = context.get("interview") or {}
    expert_id = (
        str(interview.get("expert_id"))
        if isinstance(interview, dict)
        and interview.get("expert_id") is not None
        else "UNKNOWN"
    )

    message = context.get("message")
    add_source(
        "INTERVIEW_MESSAGE",
        message,
        "CURRENT_MESSAGE",
        independence_key=f"EXPERT:{expert_id}",
    )

    for index, item in enumerate(
        context.get("retrieved_knowledge") or []
    ):
        document_id = (
            item.get("document_id")
            if isinstance(item, dict)
            else None
        )
        add_source(
            "BASELINE_CLAIM",
            item,
            f"BASELINE_CLAIM:{index}",
            independence_key=(
                f"DOCUMENT:{document_id}"
                if document_id is not None
                else None
            ),
        )

    for index, item in enumerate(
        context.get("retrieved_knowledge_units") or []
    ):
        knowledge_id = (
            item.get("knowledge_id")
            if isinstance(item, dict)
            else None
        )
        add_source(
            "KNOWLEDGE_UNIT",
            item,
            f"KNOWLEDGE_UNIT:{index}",
            independence_key=(
                f"KNOWLEDGE:{knowledge_id}"
                if knowledge_id is not None
                else None
            ),
        )

    for index, item in enumerate(
        context.get("retrieved_evidence") or []
    ):
        document_id = (
            item.get("document_id")
            if isinstance(item, dict)
            else None
        )
        add_source(
            "EVIDENCE",
            item,
            f"EVIDENCE:{index}",
            independence_key=(
                f"DOCUMENT:{document_id}"
                if document_id is not None
                else None
            ),
        )

    return result


def _score_evidence_support(
    statement: str,
    sources: list[_SupportSource],
) -> float:
    if not sources:
        return 0.0

    return _round_score(
        max(
            _text_similarity(statement, source.text)
            for source in sources
        )
    )


def _score_source_independence(
    statement: str,
    sources: list[_SupportSource],
) -> float:
    supporting_sources = {
        source.independence_key
        for source in sources
        if _text_similarity(statement, source.text)
        >= SUPPORT_SOURCE_THRESHOLD
    }

    source_count = len(supporting_sources)

    if source_count == 0:
        return 0.0

    if source_count == 1:
        return 0.5

    if source_count == 2:
        return 0.75

    return 1.0


def _score_context_completeness(
    context: dict[str, Any] | None,
) -> float:
    value = context or {}

    checks = [
        bool(value.get("domain")),
        bool(value.get("system")),
        bool(value.get("scope")),
        bool(value.get("phase")),
        bool(value.get("time")),
        bool(value.get("tags"))
        or bool(value.get("constraints")),
    ]

    return _round_score(
        sum(1 for item in checks if item)
        / len(checks)
    )


def _score_exception_completeness(
    candidate: KnowledgeCandidate,
) -> float:
    context = candidate.context or {}

    if candidate.knowledge_type == "EXCEPTION":
        checks = [
            bool(context.get("phase")),
            bool(context.get("time")),
            bool(context.get("scope")),
            bool(context.get("constraints")),
        ]

        return _round_score(
            sum(1 for item in checks if item)
            / len(checks)
        )

    if candidate.exception and candidate.exception.strip():
        return 1.0

    decision_rule = candidate.decision_rule or {}
    unless_values = decision_rule.get("unless")

    if isinstance(unless_values, list) and any(
        str(value).strip()
        for value in unless_values
    ):
        return 1.0

    # 일반 Principle/Rule에서 예외가 명시되지 않았다고 곧바로
    # 불완전으로 단정하지 않는다. PoC_V1에서는 neutral을 사용한다.
    return NEUTRAL_SCORE


def _score_outcome_evidence(
    candidate: KnowledgeCandidate,
    sources: list[_SupportSource],
) -> float:
    rationale = (
        candidate.rationale.strip()
        if candidate.rationale
        and candidate.rationale.strip()
        else ""
    )

    combined = " ".join(
        [
            candidate.statement or "",
            rationale,
            *(source.text for source in sources),
        ]
    ).lower()

    outcome_keywords = {
        "결과",
        "효과",
        "영향",
        "성공",
        "실패",
        "개선",
        "감소",
        "증가",
        "지연",
        "장애",
        "복구",
        "비용",
        "품질",
        "성능",
        "outcome",
        "result",
        "impact",
    }

    has_outcome_signal = any(
        keyword in combined
        for keyword in outcome_keywords
    )

    if (
        candidate.knowledge_type
        in {"FAILURE_LESSON", "TRADE_OFF"}
        and rationale
    ):
        return 1.0

    if rationale and has_outcome_signal:
        return 0.85

    if has_outcome_signal:
        return 0.70

    if rationale:
        return 0.60

    # 현재 모델에는 outcome 전용 구조화 필드가 없으므로
    # 증거 없음과 반증을 동일하게 취급하지 않고 neutral을 사용한다.
    return NEUTRAL_SCORE


def _score_recency(
    created_at: datetime | None,
    now: datetime | None = None,
) -> float:
    if created_at is None:
        return NEUTRAL_SCORE

    current = now or datetime.now(timezone.utc)

    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)

    value = created_at

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    age_days = max(
        0.0,
        (current - value).total_seconds() / 86400.0,
    )

    if age_days <= 30:
        return 1.0

    if age_days <= 90:
        return 0.8

    if age_days <= 180:
        return 0.6

    if age_days <= 365:
        return 0.4

    return 0.2


def calculate_validation_confidence(
    candidate: KnowledgeCandidate,
    request_context: dict[str, Any] | None,
    cross_expert_agreement: float = NEUTRAL_SCORE,
    now: datetime | None = None,
) -> ValidationConfidenceResult:
    sources = _collect_support_sources(request_context)

    dimension_scores = {
        "evidence_support": _score_evidence_support(
            candidate.statement,
            sources,
        ),
        "source_independence": _score_source_independence(
            candidate.statement,
            sources,
        ),
        "cross_expert_agreement": _round_score(
            cross_expert_agreement
        ),
        "context_completeness": _score_context_completeness(
            candidate.context
        ),
        "exception_completeness": _score_exception_completeness(
            candidate
        ),
        "outcome_evidence": _score_outcome_evidence(
            candidate,
            sources,
        ),
        "recency": _score_recency(
            candidate.created_at,
            now=now,
        ),
    }

    weighted_score = sum(
        dimension_scores[name] * weight
        for name, weight in VALIDATION_WEIGHTS.items()
    )

    return ValidationConfidenceResult(
        confidence_score=_round_score(weighted_score),
        dimension_scores={
            key: _round_score(value)
            for key, value in dimension_scores.items()
        },
    )


def _get_candidate_analysis(
    db: Session,
    candidate: KnowledgeCandidate,
) -> InterviewAnalysis | None:
    return (
        db.query(InterviewAnalysis)
        .filter(
            InterviewAnalysis.analysis_id
            == candidate.analysis_id
        )
        .first()
    )


def _score_cross_expert_agreement(
    db: Session,
    candidate: KnowledgeCandidate,
    analysis: InterviewAnalysis,
) -> float:
    current_interview = (
        db.query(Interview)
        .filter(
            Interview.interview_id
            == analysis.interview_id
        )
        .first()
    )

    if current_interview is None:
        return NEUTRAL_SCORE

    rows = (
        db.query(
            KnowledgeCandidate,
            Interview,
        )
        .join(
            InterviewAnalysis,
            InterviewAnalysis.analysis_id
            == KnowledgeCandidate.analysis_id,
        )
        .join(
            Interview,
            Interview.interview_id
            == InterviewAnalysis.interview_id,
        )
        .filter(
            InterviewAnalysis.mission_id
            == analysis.mission_id,
            KnowledgeCandidate.candidate_id
            != candidate.candidate_id,
            Interview.expert_id
            != current_interview.expert_id,
            or_(
                KnowledgeCandidate.review_status.is_(None),
                KnowledgeCandidate.review_status
                != "REJECTED",
            ),
        )
        .all()
    )

    if not rows:
        return NEUTRAL_SCORE

    best_similarity = max(
        _text_similarity(
            candidate.statement,
            other_candidate.statement,
        )
        for other_candidate, _ in rows
    )

    if best_similarity < SUPPORT_SOURCE_THRESHOLD:
        return NEUTRAL_SCORE

    # 다른 전문가의 유사 Candidate가 있을 때만 neutral(0.5) 위로
    # 올린다. 단순 미언급은 disagreement로 취급하지 않는다.
    return _round_score(
        NEUTRAL_SCORE
        + (best_similarity * 0.5)
    )


def _latest_auto_validation(
    db: Session,
    candidate_id: uuid.UUID,
) -> Validation | None:
    return (
        db.query(Validation)
        .filter(
            Validation.candidate_id == candidate_id,
            Validation.validation_type == VALIDATION_TYPE,
        )
        .order_by(
            Validation.created_at.desc(),
            Validation.validation_id.desc(),
        )
        .first()
    )


def _same_result(
    validation: Validation,
    result: ValidationConfidenceResult,
) -> bool:
    stored_score = (
        float(validation.confidence_score)
        if validation.confidence_score is not None
        else None
    )

    return (
        validation.method_version == result.method_version
        and stored_score == result.confidence_score
        and (validation.dimension_scores or {})
        == result.dimension_scores
    )


def _assess_candidate(
    db: Session,
    candidate: KnowledgeCandidate,
) -> Validation:
    analysis = _get_candidate_analysis(
        db=db,
        candidate=candidate,
    )

    if analysis is None:
        raise ValueError(
            "InterviewAnalysis not found for validation confidence"
        )

    cross_expert_agreement = _score_cross_expert_agreement(
        db=db,
        candidate=candidate,
        analysis=analysis,
    )

    result = calculate_validation_confidence(
        candidate=candidate,
        request_context=analysis.request_context,
        cross_expert_agreement=cross_expert_agreement,
    )

    latest = _latest_auto_validation(
        db=db,
        candidate_id=candidate.candidate_id,
    )

    if latest is not None and _same_result(latest, result):
        return latest

    validation = Validation(
        candidate_id=candidate.candidate_id,
        knowledge_id=None,
        validation_type=VALIDATION_TYPE,
        status=candidate.validation_status,
        reason=(
            "POC_V1 weighted Validation Confidence assessment"
        ),
        validated_by=VALIDATED_BY,
        confidence_score=result.confidence_score,
        dimension_scores=result.dimension_scores,
        method_version=result.method_version,
    )

    db.add(validation)
    db.flush()

    return validation


def assess_candidate_validation_confidence(
    db: Session,
    candidate_id: uuid.UUID,
) -> Validation:
    candidate = (
        db.query(KnowledgeCandidate)
        .filter(
            KnowledgeCandidate.candidate_id
            == candidate_id
        )
        .first()
    )

    if candidate is None:
        raise ValueError("KnowledgeCandidate not found")

    try:
        validation = _assess_candidate(
            db=db,
            candidate=candidate,
        )
        db.commit()
        db.refresh(validation)
        return validation

    except Exception:
        db.rollback()
        raise


def assess_mission_validation_confidence(
    db: Session,
    mission_id: uuid.UUID,
) -> list[Validation]:
    candidates = (
        db.query(KnowledgeCandidate)
        .join(
            InterviewAnalysis,
            InterviewAnalysis.analysis_id
            == KnowledgeCandidate.analysis_id,
        )
        .filter(
            InterviewAnalysis.mission_id
            == mission_id,
            KnowledgeCandidate.validation_status
            == "CANDIDATE",
            or_(
                KnowledgeCandidate.review_status.is_(None),
                KnowledgeCandidate.review_status
                != "REJECTED",
            ),
        )
        .order_by(
            KnowledgeCandidate.created_at.asc()
        )
        .all()
    )

    try:
        rows = [
            _assess_candidate(
                db=db,
                candidate=candidate,
            )
            for candidate in candidates
        ]

        db.commit()

        for row in rows:
            db.refresh(row)

        return rows

    except Exception:
        db.rollback()
        raise


def get_latest_validation_confidence_map(
    db: Session,
    candidate_ids: list[uuid.UUID],
) -> dict[uuid.UUID, Validation]:
    if not candidate_ids:
        return {}

    rows = (
        db.query(Validation)
        .filter(
            Validation.candidate_id.in_(candidate_ids),
            Validation.validation_type == VALIDATION_TYPE,
        )
        .order_by(
            Validation.created_at.desc(),
            Validation.validation_id.desc(),
        )
        .all()
    )

    result: dict[uuid.UUID, Validation] = {}

    for row in rows:
        if row.candidate_id not in result:
            result[row.candidate_id] = row

    return result
