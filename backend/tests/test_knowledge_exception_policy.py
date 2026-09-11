import unittest
import uuid
from types import SimpleNamespace

from app.schemas.knowledge_synthesis import (
    KnowledgeSynthesisAIResponse,
    ProposedSynthesisRelation,
    SynthesisContext,
    SynthesizedKnowledgeUnit,
)
from app.services.knowledge_synthesis_service import (
    _attach_review_synthesis_if_waiting,
    _normalize_exception_synthesis,
)


def _candidate(
    knowledge_type: str = "EXCEPTION",
):
    return SimpleNamespace(
        statement=(
            "장애 복구 절차가 검증되지 않았다면 "
            "DB 분리를 보류한다."
        ),
        knowledge_type=knowledge_type,
        context={
            "domain": "MSA Architecture",
            "system": "서비스별 물리적 DB",
            "scope": "서비스 단위",
            "constraints": [
                "장애 복구 절차가 검증되지 않음"
            ],
            "tags": [
                "장애 복구",
                "DB 분리",
            ],
        },
        decision_rule={
            "if_conditions": [
                "장애 복구 절차가 검증되지 않았다"
            ],
            "then": "DB 분리를 보류한다",
            "unless": [],
        },
        rationale="복구 검증 전에는 분리를 보류한다.",
        exception=(
            "복구 절차 미검증 시 적용된다."
        ),
        novelty_score=0.82,
        confidence_score=0.99,
        validation_status="CANDIDATE",
    )


def _knowledge(
    knowledge_type: str,
):
    return SimpleNamespace(
        knowledge_id=uuid.uuid4(),
        knowledge_type=knowledge_type,
    )


def _ai_result(
    operation: str,
    target_ids: list[uuid.UUID],
):
    relations = []

    if target_ids:
        relations.append(
            ProposedSynthesisRelation(
                synthesized_index=0,
                target_knowledge_id=target_ids[0],
                relation="REFINES",
                reason="AI original relation",
            )
        )

    return KnowledgeSynthesisAIResponse(
        operation=operation,
        target_knowledge_ids=target_ids,
        synthesized_knowledge_units=[
            SynthesizedKnowledgeUnit(
                statement=(
                    "기존 규칙에 예외를 흡수한 AI 결과"
                ),
                type="DECISION_RULE",
                context=SynthesisContext(),
                decision_rule=None,
                rationale="AI original",
                exception=None,
                novelty_score=0.8,
                confidence_score=0.9,
                validation_status="CANDIDATE",
            )
        ],
        relations=relations,
        reason="AI original result",
    )


class ExceptionPreservationPolicyTest(
    unittest.TestCase
):
    def test_exception_enrich_is_normalized_to_add_exception(self):
        candidate = _candidate()
        target = _knowledge("DECISION_RULE")
        ai_result = _ai_result(
            "ENRICH",
            [target.knowledge_id],
        )

        normalized, reason = (
            _normalize_exception_synthesis(
                candidate=candidate,
                related_knowledge=[target],
                ai_result=ai_result,
            )
        )

        self.assertEqual(
            normalized.operation,
            "ADD_EXCEPTION",
        )
        self.assertEqual(
            normalized.target_knowledge_ids,
            [target.knowledge_id],
        )
        self.assertEqual(
            len(
                normalized
                .synthesized_knowledge_units
            ),
            1,
        )
        self.assertEqual(
            normalized
            .synthesized_knowledge_units[0]
            .type,
            "EXCEPTION",
        )
        self.assertEqual(
            normalized
            .synthesized_knowledge_units[0]
            .statement,
            candidate.statement,
        )
        self.assertEqual(
            len(normalized.relations),
            1,
        )
        self.assertEqual(
            normalized.relations[0].relation,
            "HAS_EXCEPTION",
        )
        self.assertEqual(
            normalized
            .relations[0]
            .target_knowledge_id,
            target.knowledge_id,
        )
        self.assertIn(
            "EXCEPTION preservation policy",
            reason,
        )

    def test_exception_can_attach_to_principle(self):
        candidate = _candidate()
        target = _knowledge("PRINCIPLE")
        ai_result = _ai_result(
            "SUPERSEDE",
            [target.knowledge_id],
        )

        normalized, _ = (
            _normalize_exception_synthesis(
                candidate=candidate,
                related_knowledge=[target],
                ai_result=ai_result,
            )
        )

        self.assertEqual(
            normalized.operation,
            "ADD_EXCEPTION",
        )
        self.assertEqual(
            normalized.relations[0].relation,
            "HAS_EXCEPTION",
        )

    def test_keep_conflict_is_not_overridden(self):
        candidate = _candidate()
        target = _knowledge("DECISION_RULE")
        ai_result = _ai_result(
            "KEEP_CONFLICT",
            [target.knowledge_id],
        )

        normalized, reason = (
            _normalize_exception_synthesis(
                candidate=candidate,
                related_knowledge=[target],
                ai_result=ai_result,
            )
        )

        self.assertIs(
            normalized,
            ai_result,
        )
        self.assertIsNone(reason)
        self.assertEqual(
            normalized.operation,
            "KEEP_CONFLICT",
        )

    def test_split_by_context_is_not_overridden(self):
        candidate = _candidate()
        target = _knowledge("DECISION_RULE")
        ai_result = _ai_result(
            "SPLIT_BY_CONTEXT",
            [target.knowledge_id],
        )

        normalized, reason = (
            _normalize_exception_synthesis(
                candidate=candidate,
                related_knowledge=[target],
                ai_result=ai_result,
            )
        )

        self.assertIs(
            normalized,
            ai_result,
        )
        self.assertIsNone(reason)

    def test_non_exception_candidate_is_not_overridden(self):
        candidate = _candidate("PRINCIPLE")
        target = _knowledge("DECISION_RULE")
        ai_result = _ai_result(
            "ENRICH",
            [target.knowledge_id],
        )

        normalized, reason = (
            _normalize_exception_synthesis(
                candidate=candidate,
                related_knowledge=[target],
                ai_result=ai_result,
            )
        )

        self.assertIs(
            normalized,
            ai_result,
        )
        self.assertIsNone(reason)

    def test_ambiguous_parent_is_not_chosen_by_backend(self):
        candidate = _candidate()
        target_a = _knowledge("DECISION_RULE")
        target_b = _knowledge("PRINCIPLE")

        ai_result = _ai_result(
            "MERGE",
            [],
        )

        normalized, reason = (
            _normalize_exception_synthesis(
                candidate=candidate,
                related_knowledge=[
                    target_a,
                    target_b,
                ],
                ai_result=ai_result,
            )
        )

        self.assertIs(
            normalized,
            ai_result,
        )
        self.assertIsNone(reason)
        self.assertEqual(
            normalized.operation,
            "MERGE",
        )

    def test_resynthesis_reconnects_waiting_review_candidate(self):
        synthesis_id = uuid.uuid4()
        candidate = SimpleNamespace(
            review_status="REVIEW_REQUIRED",
            review_synthesis_id=None,
            review_reason=(
                "Knowledge graph changed; re-synthesis required"
            ),
        )
        synthesis = SimpleNamespace(
            synthesis_id=synthesis_id,
        )

        changed = (
            _attach_review_synthesis_if_waiting(
                candidate=candidate,
                synthesis=synthesis,
            )
        )

        self.assertTrue(changed)
        self.assertEqual(
            candidate.review_synthesis_id,
            synthesis_id,
        )
        self.assertIn(
            "current knowledge graph",
            candidate.review_reason,
        )

    def test_initial_non_review_candidate_is_not_force_attached(self):
        synthesis_id = uuid.uuid4()
        candidate = SimpleNamespace(
            review_status=None,
            review_synthesis_id=None,
            review_reason=None,
        )
        synthesis = SimpleNamespace(
            synthesis_id=synthesis_id,
        )

        changed = (
            _attach_review_synthesis_if_waiting(
                candidate=candidate,
                synthesis=synthesis,
            )
        )

        self.assertFalse(changed)
        self.assertIsNone(
            candidate.review_synthesis_id
        )

    def test_single_compatible_parent_can_be_used_when_ai_target_empty(self):
        candidate = _candidate()
        target = _knowledge("DECISION_RULE")
        unrelated = _knowledge("EXCEPTION")

        ai_result = _ai_result(
            "MERGE",
            [],
        )

        normalized, _ = (
            _normalize_exception_synthesis(
                candidate=candidate,
                related_knowledge=[
                    target,
                    unrelated,
                ],
                ai_result=ai_result,
            )
        )

        self.assertEqual(
            normalized.operation,
            "ADD_EXCEPTION",
        )
        self.assertEqual(
            normalized.target_knowledge_ids,
            [target.knowledge_id],
        )


if __name__ == "__main__":
    unittest.main()
