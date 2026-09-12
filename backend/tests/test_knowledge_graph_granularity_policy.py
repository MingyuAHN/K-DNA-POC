import inspect
import unittest
import uuid
from types import SimpleNamespace

import app.services.auto_knowledge_sync_service as auto_service
import app.services.knowledge_synthesis_apply_service as apply_service
from app.schemas.knowledge_synthesis import (
    KnowledgeSynthesisAIResponse,
    ProposedSynthesisRelation,
    SynthesisContext,
    SynthesizedKnowledgeUnit,
)
from app.services.knowledge_synthesis_service import (
    _normalize_atomic_version_policy,
)


def _candidate(
    knowledge_type: str,
    statement: str,
):
    return SimpleNamespace(
        knowledge_type=knowledge_type,
        statement=statement,
        context={
            "domain": "MSA",
            "phase": "운영 장애 대응",
            "scope": "DB 접근 통제",
            "constraints": [],
            "tags": [],
        },
        decision_rule=None,
        rationale=None,
        exception=None,
        novelty_score=0.9,
        confidence_score=0.99,
        validation_status="CANDIDATE",
    )


def _knowledge(
    knowledge_type: str,
    statement: str,
):
    return SimpleNamespace(
        knowledge_id=uuid.uuid4(),
        knowledge_type=knowledge_type,
        statement=statement,
    )


def _proposal(
    knowledge_type: str,
    statement: str,
):
    return SynthesizedKnowledgeUnit(
        statement=statement,
        type=knowledge_type,
        context=SynthesisContext(
            domain="MSA",
            phase="운영 장애 대응",
            scope="DB 접근 통제",
        ),
        decision_rule=None,
        rationale=None,
        exception=None,
        novelty_score=0.9,
        confidence_score=0.99,
        validation_status="CANDIDATE",
    )


class KnowledgeGraphGranularityPolicyTest(unittest.TestCase):
    def test_cross_type_enrich_becomes_independent_merge(self):
        candidate = _candidate(
            "PRINCIPLE",
            "긴급 조회 시 승인, 읽기 전용, 감사 로그가 필요하다.",
        )
        target = _knowledge(
            "EXCEPTION",
            "긴급 장애 시 타 서비스 DB 읽기 조회를 예외 허용한다.",
        )
        ai_result = KnowledgeSynthesisAIResponse(
            operation="ENRICH",
            target_knowledge_ids=[target.knowledge_id],
            synthesized_knowledge_units=[
                _proposal(
                    "EXCEPTION",
                    "긴급 장애 시 승인과 감사 통제를 포함해 조회한다.",
                )
            ],
            relations=[
                ProposedSynthesisRelation(
                    synthesized_index=0,
                    target_knowledge_id=target.knowledge_id,
                    relation="SUPERSEDES",
                    reason="AI proposed replacement",
                )
            ],
            reason="AI enrich",
        )

        normalized, reason = _normalize_atomic_version_policy(
            candidate=candidate,
            related_knowledge=[target],
            ai_result=ai_result,
        )

        self.assertEqual(normalized.operation, "MERGE")
        self.assertEqual(normalized.target_knowledge_ids, [])
        self.assertEqual(
            normalized.synthesized_knowledge_units[0].type,
            "PRINCIPLE",
        )
        self.assertEqual(
            normalized.synthesized_knowledge_units[0].statement,
            candidate.statement,
        )
        self.assertEqual(normalized.relations[0].relation, "REFINES")
        self.assertIsNotNone(reason)

    def test_same_type_enrich_keeps_version_operation(self):
        candidate = _candidate(
            "EXCEPTION",
            "긴급 장애 시 읽기 조회를 예외 허용한다.",
        )
        target = _knowledge(
            "EXCEPTION",
            "긴급 장애 시 타 서비스 DB 조회를 예외 허용한다.",
        )
        ai_result = KnowledgeSynthesisAIResponse(
            operation="ENRICH",
            target_knowledge_ids=[target.knowledge_id],
            synthesized_knowledge_units=[
                _proposal(
                    "EXCEPTION",
                    "긴급 장애 시 읽기 전용 조회를 예외 허용한다.",
                )
            ],
            relations=[],
            reason="same atomic knowledge",
        )

        normalized, reason = _normalize_atomic_version_policy(
            candidate=candidate,
            related_knowledge=[target],
            ai_result=ai_result,
        )

        self.assertIs(normalized, ai_result)
        self.assertEqual(normalized.operation, "ENRICH")
        self.assertIsNone(reason)

    def test_merge_with_existing_does_not_supersede_target(self):
        candidate = _candidate(
            "DECISION_RULE",
            "장애 종료 후 임시 DB 접근 권한을 회수한다.",
        )
        target = _knowledge(
            "EXCEPTION",
            "긴급 장애 시 읽기 조회를 예외 허용한다.",
        )
        ai_result = KnowledgeSynthesisAIResponse(
            operation="MERGE",
            target_knowledge_ids=[target.knowledge_id],
            synthesized_knowledge_units=[
                _proposal(
                    "DECISION_RULE",
                    "긴급 조회 규칙과 장애 종료 후 권한 회수를 함께 적용한다.",
                )
            ],
            relations=[
                ProposedSynthesisRelation(
                    synthesized_index=0,
                    target_knowledge_id=target.knowledge_id,
                    relation="SUPERSEDES",
                    reason="AI merge",
                )
            ],
            reason="merge",
        )

        normalized, _ = _normalize_atomic_version_policy(
            candidate=candidate,
            related_knowledge=[target],
            ai_result=ai_result,
        )

        self.assertEqual(normalized.operation, "MERGE")
        self.assertEqual(normalized.target_knowledge_ids, [])
        self.assertEqual(
            normalized.synthesized_knowledge_units[0].statement,
            candidate.statement,
        )
        self.assertEqual(normalized.relations[0].relation, "REFINES")

    def test_auto_sync_no_longer_promotes_merge_to_enrich(self):
        source = inspect.getsource(
            auto_service._normalize_auto_operation
        )
        self.assertNotIn("MERGE -> ENRICH", source)
        self.assertIn("same_type_chain", source)

    def test_apply_has_mission_wide_freshness_guard(self):
        source = inspect.getsource(
            apply_service.validate_and_apply_synthesis
        )
        self.assertIn(
            "_find_newer_applied_mission_graph_synthesis(",
            source,
        )
        self.assertIn(
            "_mark_waiting_mission_syntheses_stale_after_graph_change(",
            source,
        )

    def test_apply_merge_does_not_supersede_targets(self):
        source = inspect.getsource(
            apply_service.validate_and_apply_synthesis
        )
        merge_start = source.index(
            'elif synthesis.operation == "MERGE":'
        )
        add_exception_start = source.index(
            "# ADD_EXCEPTION",
            merge_start,
        )
        merge_block = source[
            merge_start:add_exception_start
        ]

        self.assertNotIn(
            'relation_type="SUPERSEDES"',
            merge_block,
        )
        self.assertNotIn(
            'target.status = "SUPERSEDED"',
            merge_block,
        )


    def test_apply_merge_rechecks_duplicate_before_create(self):
        """
        STALE 이후 수동 re-Synthesis된 독립 MERGE는 현재 Mission의
        활성 Knowledge를 기준으로 duplicate/no-op를 다시 확인한 뒤
        새 KnowledgeUnit을 생성해야 한다.
        """
        source = inspect.getsource(
            apply_service.validate_and_apply_synthesis
        )

        merge_start = source.index(
            'elif synthesis.operation == "MERGE":'
        )
        add_exception_start = source.index(
            "# ADD_EXCEPTION",
            merge_start,
        )
        merge_block = source[
            merge_start:add_exception_start
        ]

        duplicate_guard_index = merge_block.index(
            "find_duplicate_active_knowledge("
        )
        create_index = merge_block.index(
            "_create_new_unit("
        )

        self.assertLess(
            duplicate_guard_index,
            create_index,
        )
        self.assertIn(
            "existing active knowledge reused",
            merge_block,
        )



    def test_apply_enrich_rechecks_duplicate_before_version_create(self):
        """
        AI가 같은-type target을 ENRICH하더라도 Candidate 자체가 Mission의
        다른 활성 Knowledge와 이미 같은 의미라면 새 version으로 흡수하지
        않고 기존 Knowledge를 재사용해야 한다.

        실제 E2E의 EXCEPTION -> DECISION_RULE type-drift duplicate가
        기존 DECISION_RULE target의 v2로 흡수되는 회귀를 막는다.
        """
        source = inspect.getsource(
            apply_service.validate_and_apply_synthesis
        )

        enrich_start = source.index(
            'if synthesis.operation in {\n            "ENRICH",'
        )
        merge_start = source.index(
            'elif synthesis.operation == "MERGE":',
            enrich_start,
        )
        enrich_block = source[
            enrich_start:merge_start
        ]

        duplicate_guard_index = enrich_block.index(
            "find_duplicate_active_knowledge("
        )
        material_guard_index = enrich_block.index(
            "assess_synthesized_unit_material_change("
        )
        create_index = enrich_block.index(
            "_create_new_unit("
        )

        self.assertLess(
            duplicate_guard_index,
            material_guard_index,
        )
        self.assertLess(
            duplicate_guard_index,
            create_index,
        )
        self.assertIn(
            "candidate duplicate/no-op",
            enrich_block,
        )
        self.assertIn(
            "existing active knowledge reused",
            enrich_block,
        )


if __name__ == "__main__":
    unittest.main()
