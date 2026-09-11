import inspect
import unittest
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import app.services.knowledge_synthesis_apply_service as apply_service
from app.services.knowledge_synthesis_apply_service import (
    _mark_synthesis_stale_for_graph_change,
)


class KnowledgeReviewGraphFreshnessTest(unittest.TestCase):
    def test_waiting_synthesis_becomes_stale_after_graph_change(self):
        synthesis_id = uuid.uuid4()
        applied_synthesis_id = uuid.uuid4()

        synthesis = SimpleNamespace(
            synthesis_id=synthesis_id,
            status="PENDING",
            validated_by=None,
            validation_reason=None,
            validated_at=None,
        )
        candidate = SimpleNamespace(
            review_status="REVIEW_REQUIRED",
            review_synthesis_id=synthesis_id,
            review_reason="waiting for review",
        )
        now = datetime.now(timezone.utc)

        _mark_synthesis_stale_for_graph_change(
            synthesis=synthesis,
            candidate=candidate,
            applied_synthesis_id=applied_synthesis_id,
            validated_by="BACKEND_E2E_REVIEWER",
            now=now,
        )

        self.assertEqual(synthesis.status, "STALE")
        self.assertEqual(
            synthesis.validated_by,
            "BACKEND_E2E_REVIEWER",
        )
        self.assertEqual(synthesis.validated_at, now)
        self.assertIn(
            str(applied_synthesis_id),
            synthesis.validation_reason,
        )
        self.assertIsNone(candidate.review_synthesis_id)
        self.assertEqual(
            candidate.review_status,
            "REVIEW_REQUIRED",
        )
        self.assertIn(
            "re-synthesis is required",
            candidate.review_reason,
        )

    def test_applied_synthesis_is_not_rewritten(self):
        synthesis_id = uuid.uuid4()

        synthesis = SimpleNamespace(
            synthesis_id=synthesis_id,
            status="APPLIED",
            validated_by="ORIGINAL",
            validation_reason="already applied",
            validated_at="original-time",
        )
        candidate = SimpleNamespace(
            review_status="RESOLVED",
            review_synthesis_id=synthesis_id,
            review_reason="approved",
        )

        _mark_synthesis_stale_for_graph_change(
            synthesis=synthesis,
            candidate=candidate,
            applied_synthesis_id=uuid.uuid4(),
            validated_by="NEW_REVIEWER",
            now=datetime.now(timezone.utc),
        )

        self.assertEqual(synthesis.status, "APPLIED")
        self.assertEqual(synthesis.validated_by, "ORIGINAL")
        self.assertEqual(
            synthesis.validation_reason,
            "already applied",
        )
        self.assertEqual(
            candidate.review_synthesis_id,
            synthesis_id,
        )
        self.assertEqual(
            candidate.review_status,
            "RESOLVED",
        )

    def test_apply_path_invalidates_waiting_siblings(self):
        source = inspect.getsource(
            apply_service.validate_and_apply_synthesis
        )

        self.assertIn(
            "_mark_waiting_syntheses_stale_after_graph_change(",
            source,
        )
        self.assertIn(
            "analysis_id=analysis.analysis_id",
            source,
        )
        self.assertIn(
            "applied_candidate_id=candidate.candidate_id",
            source,
        )
        self.assertIn(
            "applied_synthesis_id=synthesis.synthesis_id",
            source,
        )

    def test_preapprove_guard_checks_for_newer_applied_sibling(self):
        source = inspect.getsource(
            apply_service.validate_and_apply_synthesis
        )

        self.assertIn(
            "_find_newer_applied_sibling_synthesis(",
            source,
        )

        # The HTTPException detail is written as adjacent string
        # literals across multiple source lines. Python joins them
        # at runtime, but inspect.getsource() returns the original
        # source text. Check the pieces instead of one contiguous
        # runtime sentence.
        self.assertIn(
            '"Knowledge synthesis is stale because another "',
            source,
        )
        self.assertIn(
            '"candidate from the same interview analysis was "',
            source,
        )
        self.assertIn(
            '"approved after this synthesis was created; "',
            source,
        )
        self.assertIn(
            '"create a new synthesis before validation"',
            source,
        )

    def test_noop_reuse_returns_before_sibling_invalidation(self):
        source = inspect.getsource(
            apply_service.validate_and_apply_synthesis
        )

        noop_return_index = source.find(
            "Knowledge version inflation suppressed"
        )
        sibling_guard_index = source.find(
            "_mark_waiting_syntheses_stale_after_graph_change("
        )

        self.assertGreaterEqual(noop_return_index, 0)
        self.assertGreaterEqual(sibling_guard_index, 0)
        self.assertLess(
            noop_return_index,
            sibling_guard_index,
        )


if __name__ == "__main__":
    unittest.main()
