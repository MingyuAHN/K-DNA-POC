import re
import unicodedata
from difflib import SequenceMatcher

from shared.schemas.interview import (
    KnowledgeCandidate,
    KnowledgeGap,
    ConflictResult,
    QuestionCandidate,
)


MAX_KNOWLEDGE_CANDIDATES = 3
MAX_GAPS = 5
MAX_CONFLICTS = 5
MAX_QUESTION_CANDIDATES = 3


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    text = text.lower()
    text = re.sub(r"[^0-9a-zA-Z가-힣]", "", text)
    return text


def _similar(
    first: str,
    second: str,
    threshold: float = 0.72,
) -> bool:
    first_normalized = _normalize(first)
    second_normalized = _normalize(second)

    if not first_normalized or not second_normalized:
        return False

    return (
        SequenceMatcher(
            None,
            first_normalized,
            second_normalized,
        ).ratio()
        >= threshold
    )

def is_similar_text(
    first: str,
    second: str,
    threshold: float = 0.82,
) -> bool:
    return _similar(
        first,
        second,
        threshold=threshold,
    )

def select_knowledge_candidates(
    candidates: list[KnowledgeCandidate],
) -> list[KnowledgeCandidate]:

    ranked = sorted(
        candidates,
        key=lambda item: (
            item.confidence_score,
            item.novelty_score,
        ),
        reverse=True,
    )

    return ranked[:MAX_KNOWLEDGE_CANDIDATES]


def deduplicate_gaps(
    gaps: list[KnowledgeGap],
) -> list[KnowledgeGap]:

    merged: list[KnowledgeGap] = []

    # 높은 Gap부터 처리
    ranked = sorted(
        gaps,
        key=lambda item: item.gap_score,
        reverse=True,
    )

    for gap in ranked:
        duplicate = False

        for existing in merged:
            same_dimension = (
                existing.dimension == gap.dimension
            )

            similar_topic = _similar(
                existing.topic,
                gap.topic,
            )

            if same_dimension and similar_topic:
                duplicate = True
                break

        if not duplicate:
            merged.append(gap)

    return merged[:MAX_GAPS]


def select_conflicts(
    conflicts: list[ConflictResult],
) -> list[ConflictResult]:

    severity_rank = {
        "CRITICAL": 4,
        "HIGH": 3,
        "MEDIUM": 2,
        "LOW": 1,
    }

    unique: list[ConflictResult] = []

    ranked = sorted(
        conflicts,
        key=lambda item: severity_rank.get(
            item.severity.value,
            0,
        ),
        reverse=True,
    )

    def source_signature(
        conflict: ConflictResult,
    ) -> tuple:

        sources = []

        for source in conflict.sources:
            source_type = getattr(
                source.source_type,
                "value",
                source.source_type,
            )

            sources.append(
                (
                    str(source_type),
                    str(source.source_id),
                )
            )

        return tuple(sorted(sources))

    for conflict in ranked:
        duplicate = False

        current_sources = source_signature(
            conflict
        )

        for existing in unique:
            same_type = (
                existing.conflict_type
                == conflict.conflict_type
            )

            same_sources = (
                bool(current_sources)
                and current_sources
                == source_signature(existing)
            )

            similar_description = _similar(
                existing.description,
                conflict.description,
                threshold=0.78,
            )

            if same_type and (
                same_sources
                or similar_description
            ):
                duplicate = True

                print(
                    "[CONFLICT-GLOBAL-DEDUP] "
                    "skip duplicate conflict: "
                    f"type={conflict.conflict_type}, "
                    f"sources={current_sources}",
                    flush=True,
                )

                break

        if not duplicate:
            unique.append(conflict)

    return unique[:MAX_CONFLICTS]


def select_questions(
    questions: list[QuestionCandidate],
) -> list[QuestionCandidate]:

    unique: list[QuestionCandidate] = []

    ranked = sorted(
        questions,
        key=lambda item: item.value_score,
        reverse=True,
    )

    for question in ranked:
        if any(
            _similar(
                question.question,
                existing.question,
                threshold=0.80,
            )
            for existing in unique
        ):
            continue

        unique.append(question)

        if len(unique) >= MAX_QUESTION_CANDIDATES:
            break

    return unique