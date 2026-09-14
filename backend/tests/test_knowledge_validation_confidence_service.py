import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.knowledge_validation_confidence_service import (
    NEUTRAL_SCORE,
    VALIDATION_METHOD_VERSION,
    VALIDATION_WEIGHTS,
    calculate_validation_confidence,
)


def _candidate(
    *,
    statement="서비스 간 데이터 조회는 API를 사용한다.",
    knowledge_type="PRINCIPLE",
    context=None,
    decision_rule=None,
    rationale=None,
    exception=None,
    created_at=None,
):
    return SimpleNamespace(
        statement=statement,
        knowledge_type=knowledge_type,
        context=(
            context
            if context is not None
            else {
                "domain": "MSA Architecture",
                "system": "서비스 간 연계",
                "scope": "데이터 조회",
                "phase": "운영",
                "time": "평상시",
                "tags": ["API"],
                "constraints": [],
            }
        ),
        decision_rule=decision_rule,
        rationale=rationale,
        exception=exception,
        created_at=(
            created_at
            if created_at is not None
            else datetime.now(timezone.utc)
        ),
    )


def _context(
    message="서비스 간 데이터 조회는 API를 사용한다.",
    include_baseline=False,
    include_evidence=False,
):
    payload = {
        "interview": {
            "expert_id": "expert-1",
        },
        "message": {
            "message_id": "m1",
            "content": message,
        },
        "retrieved_knowledge": [],
        "retrieved_knowledge_units": [],
        "retrieved_evidence": [],
    }

    if include_baseline:
        payload["retrieved_knowledge"].append(
            {
                "claim_id": "c1",
                "document_id": "doc-1",
                "statement": message,
            }
        )

    if include_evidence:
        payload["retrieved_evidence"].append(
            {
                "chunk_id": "e1",
                "document_id": "doc-2",
                "content": message,
            }
        )

    return payload


class KnowledgeValidationConfidenceServiceTest(unittest.TestCase):
    def test_weights_sum_to_one(self):
        self.assertAlmostEqual(
            sum(VALIDATION_WEIGHTS.values()),
            1.0,
        )

    def test_exact_interview_message_gives_full_evidence_support(self):
        result = calculate_validation_confidence(
            candidate=_candidate(),
            request_context=_context(),
        )

        self.assertEqual(
            result.dimension_scores["evidence_support"],
            1.0,
        )

    def test_multiple_supporting_source_families_raise_independence(self):
        result = calculate_validation_confidence(
            candidate=_candidate(),
            request_context=_context(
                include_baseline=True,
                include_evidence=True,
            ),
        )

        self.assertEqual(
            result.dimension_scores["source_independence"],
            1.0,
        )

    def test_single_message_source_has_half_independence(self):
        result = calculate_validation_confidence(
            candidate=_candidate(),
            request_context=_context(),
        )

        self.assertEqual(
            result.dimension_scores["source_independence"],
            0.5,
        )

    def test_complete_context_scores_one(self):
        result = calculate_validation_confidence(
            candidate=_candidate(),
            request_context=_context(),
        )

        self.assertEqual(
            result.dimension_scores["context_completeness"],
            1.0,
        )

    def test_exception_uses_boundary_context_for_completeness(self):
        candidate = _candidate(
            knowledge_type="EXCEPTION",
            context={
                "domain": "MSA Architecture",
                "system": "Shared DB",
                "scope": "직접 접근",
                "phase": "초기 Migration",
                "time": "한시적",
                "tags": ["Shared DB"],
                "constraints": ["서비스 경계 미분리"],
            },
        )

        result = calculate_validation_confidence(
            candidate=candidate,
            request_context=_context(
                message=candidate.statement,
            ),
        )

        self.assertEqual(
            result.dimension_scores["exception_completeness"],
            1.0,
        )

    def test_non_exception_without_explicit_exception_is_neutral(self):
        result = calculate_validation_confidence(
            candidate=_candidate(),
            request_context=_context(),
        )

        self.assertEqual(
            result.dimension_scores["exception_completeness"],
            NEUTRAL_SCORE,
        )

    def test_no_cross_expert_signal_stays_neutral(self):
        result = calculate_validation_confidence(
            candidate=_candidate(),
            request_context=_context(),
        )

        self.assertEqual(
            result.dimension_scores["cross_expert_agreement"],
            NEUTRAL_SCORE,
        )

    def test_old_candidate_has_lower_recency(self):
        now = datetime(2026, 9, 14, tzinfo=timezone.utc)
        candidate = _candidate(
            created_at=now - timedelta(days=400),
        )

        result = calculate_validation_confidence(
            candidate=candidate,
            request_context=_context(),
            now=now,
        )

        self.assertEqual(
            result.dimension_scores["recency"],
            0.2,
        )

    def test_total_is_weighted_sum_and_method_is_versioned(self):
        result = calculate_validation_confidence(
            candidate=_candidate(),
            request_context=_context(
                include_baseline=True,
            ),
            cross_expert_agreement=0.8,
        )

        expected = round(
            sum(
                result.dimension_scores[name] * weight
                for name, weight in VALIDATION_WEIGHTS.items()
            ),
            4,
        )

        self.assertEqual(result.confidence_score, expected)
        self.assertEqual(
            result.method_version,
            VALIDATION_METHOD_VERSION,
        )


if __name__ == "__main__":
    unittest.main()
