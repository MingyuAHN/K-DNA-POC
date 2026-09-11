import inspect
import unittest
import uuid
from types import SimpleNamespace

import app.services.auto_knowledge_sync_service as auto_sync_service
from app.services.knowledge_synthesis_apply_service import (
    _mark_synthesis_stale_for_target_change,
)


class _FakeDb:
    def __init__(self):
        self.commit_count = 0
        self.refreshed = []

    def commit(self):
        self.commit_count += 1

    def refresh(self, value):
        self.refreshed.append(value)


class AutoKnowledgeReviewPolicyTest(unittest.TestCase):
    def test_material_candidate_standard_path_requires_human_review(self):
        source = inspect.getsource(
            auto_sync_service.sync_analysis_to_knowledge
        )

        self.assertIn(
            "Human review is required before applying synthesized",
            source,
        )
        self.assertIn(
            "status='REVIEW_REQUIRED'",
            source,
        )
        self.assertNotIn(
            "Candidate synthesized and applied successfully",
            source,
        )

    def test_candidate_confidence_is_not_auto_approve_threshold(self):
        module_source = inspect.getsource(auto_sync_service)

        self.assertNotIn(
            "AUTO_MIN_CONFIDENCE_SCORE",
            module_source,
        )
        self.assertNotIn(
            "automatic approval threshold",
            module_source,
        )

    def test_noop_reuse_remains_auto_exception(self):
        source = inspect.getsource(
            auto_sync_service.sync_analysis_to_knowledge
        )

        self.assertIn(
            "if not material_assessment.material_change:",
            source,
        )
        self.assertIn(
            "AUTO_NOOP_REUSE_REASON",
            source,
        )

        # The runtime detail message is written as adjacent Python
        # string literals across two source lines:
        #
        #   'material knowledge change; existing '
        #   'VERIFIED Knowledge Unit reused'
        #
        # Python concatenates them at runtime, but inspect.getsource()
        # returns the original source text, so asserting the fully
        # concatenated sentence would be formatting-dependent.
        self.assertIn(
            "'material knowledge change; existing '",
            source,
        )
        self.assertIn(
            "'VERIFIED Knowledge Unit reused'",
            source,
        )

    def test_target_change_marks_waiting_synthesis_stale(self):
        db = _FakeDb()
        synthesis = SimpleNamespace(
            status="PENDING",
            validated_by=None,
            validation_reason=None,
            validated_at=None,
        )
        candidate = SimpleNamespace(
            review_status="REVIEW_REQUIRED",
            review_synthesis_id=uuid.uuid4(),
            review_reason="waiting",
        )
        target_id = uuid.uuid4()

        _mark_synthesis_stale_for_target_change(
            db=db,
            synthesis=synthesis,
            candidate=candidate,
            target_ids=[target_id],
            validated_by="REVIEWER",
            now=SimpleNamespace(),
        )

        self.assertEqual(synthesis.status, "STALE")
        self.assertEqual(synthesis.validated_by, "REVIEWER")
        self.assertIn(str(target_id), synthesis.validation_reason)
        self.assertIsNone(candidate.review_synthesis_id)
        self.assertEqual(candidate.review_status, "REVIEW_REQUIRED")
        self.assertIn("re-synthesis is required", candidate.review_reason)
        self.assertEqual(db.commit_count, 1)
        self.assertEqual(len(db.refreshed), 2)


if __name__ == "__main__":
    unittest.main()
