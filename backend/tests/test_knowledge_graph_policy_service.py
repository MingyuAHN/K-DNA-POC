import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import patch

from app.services.knowledge_graph_policy_service import (
    GraphApplyAction,
    KnowledgeGraphPolicyViolation,
    build_knowledge_graph_policy_plan,
)


def _candidate(
    knowledge_type="PRINCIPLE",
    statement="candidate",
    exception=None,
):
    return SimpleNamespace(
        knowledge_type=knowledge_type,
        statement=statement,
        context={
            "domain": "MSA Architecture",
            "phase": "운영",
            "scope": "DB 접근",
            "tags": ["운영", "DB 접근"],
            "constraints": [],
        },
        decision_rule=None,
        rationale=None,
        exception=exception,
    )


def _knowledge(
    knowledge_type="PRINCIPLE",
    statement="knowledge",
):
    return SimpleNamespace(
        knowledge_id=uuid.uuid4(),
        knowledge_type=knowledge_type,
        statement=statement,
        context={},
        decision_rule=None,
        rationale=None,
        exception=None,
        version=1,
        root_knowledge_id=None,
        status="VERIFIED",
    )


def _proposal(
    knowledge_type="PRINCIPLE",
    statement="proposal",
    index=0,
):
    return SimpleNamespace(
        synthesized_index=index,
        synthesis_unit_id=uuid.uuid4(),
        statement=statement,
        knowledge_type=knowledge_type,
        context={},
        decision_rule=None,
        rationale=None,
        exception=None,
    )


def _synthesis(operation):
    return SimpleNamespace(
        operation=operation,
        mission_id=uuid.uuid4(),
    )


def _relation(
    proposal,
    target,
    relation_type,
):
    return SimpleNamespace(
        synthesized_index=proposal.synthesized_index,
        target_knowledge_id=target.knowledge_id,
        relation_type=relation_type,
    )


class KnowledgeGraphPolicyServiceTest(unittest.TestCase):
    def test_merge_duplicate_reuses_existing(self):
        synthesis = _synthesis("MERGE")
        candidate = _candidate()
        proposal = _proposal()
        existing = _knowledge()
        match = SimpleNamespace(
            knowledge=existing,
            match_type="SEMANTIC",
        )

        with patch(
            "app.services.knowledge_graph_policy_service."
            "find_duplicate_active_knowledge",
            return_value=match,
        ):
            plan = build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[],
                relations=[],
            )

        self.assertEqual(
            plan.action,
            GraphApplyAction.REUSE_EXISTING,
        )
        self.assertIs(plan.reused_knowledge, existing)
        self.assertFalse(plan.apply_proposed_relations)

    def test_enrich_duplicate_reuses_existing_before_material_check(self):
        synthesis = _synthesis("ENRICH")
        candidate = _candidate("DECISION_RULE")
        proposal = _proposal("DECISION_RULE")
        target = _knowledge("DECISION_RULE")
        existing = _knowledge("EXCEPTION")
        match = SimpleNamespace(
            knowledge=existing,
            match_type="TYPE_DRIFT_NOOP",
        )

        with patch(
            "app.services.knowledge_graph_policy_service."
            "find_duplicate_active_knowledge",
            return_value=match,
        ), patch(
            "app.services.knowledge_graph_policy_service."
            "assess_synthesized_unit_material_change",
            side_effect=AssertionError(
                "material check must not run after duplicate reuse"
            ),
        ):
            plan = build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[target],
                relations=[],
            )

        self.assertEqual(
            plan.action,
            GraphApplyAction.REUSE_EXISTING,
        )
        self.assertIs(plan.reused_knowledge, existing)

    def test_split_by_context_duplicate_cannot_bypass_reuse(self):
        synthesis = _synthesis("SPLIT_BY_CONTEXT")
        candidate = _candidate("DECISION_RULE")
        proposal = _proposal("DECISION_RULE")
        target = _knowledge("DECISION_RULE")
        existing = _knowledge("EXCEPTION")
        match = SimpleNamespace(
            knowledge=existing,
            match_type="TYPE_DRIFT_NOOP",
        )

        with patch(
            "app.services.knowledge_graph_policy_service."
            "find_duplicate_active_knowledge",
            return_value=match,
        ):
            plan = build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[target],
                relations=[],
            )

        self.assertEqual(
            plan.action,
            GraphApplyAction.REUSE_EXISTING,
        )
        self.assertFalse(plan.apply_proposed_relations)

    def test_keep_conflict_still_passes_shared_duplicate_gate(self):
        synthesis = _synthesis("KEEP_CONFLICT")
        candidate = _candidate("PRINCIPLE")
        proposal = _proposal("PRINCIPLE")
        existing = _knowledge("PRINCIPLE")
        match = SimpleNamespace(
            knowledge=existing,
            match_type="EXACT",
        )

        with patch(
            "app.services.knowledge_graph_policy_service."
            "find_duplicate_active_knowledge",
            return_value=match,
        ):
            plan = build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[],
                relations=[],
            )

        self.assertEqual(
            plan.action,
            GraphApplyAction.REUSE_EXISTING,
        )

    def test_add_exception_duplicate_reuses_exception_and_keeps_relation(self):
        synthesis = _synthesis("ADD_EXCEPTION")
        candidate = _candidate(
            "PRINCIPLE",
            exception="장애 시 직접 읽기 예외",
        )
        parent = _knowledge("PRINCIPLE")
        proposal = _proposal(
            "EXCEPTION",
            "장애 시 직접 읽기 예외",
        )
        relation = _relation(
            proposal,
            parent,
            "HAS_EXCEPTION",
        )
        existing_exception = _knowledge("EXCEPTION")
        match = SimpleNamespace(
            knowledge=existing_exception,
            match_type="SEMANTIC",
        )

        with patch(
            "app.services.knowledge_graph_policy_service."
            "find_duplicate_active_knowledge",
            return_value=match,
        ):
            plan = build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[parent],
                relations=[relation],
            )

        self.assertEqual(
            plan.action,
            GraphApplyAction.REUSE_EXISTING,
        )
        self.assertIs(
            plan.reused_knowledge,
            existing_exception,
        )
        self.assertTrue(plan.apply_proposed_relations)

    def test_add_exception_duplicate_must_resolve_to_exception(self):
        synthesis = _synthesis("ADD_EXCEPTION")
        candidate = _candidate("PRINCIPLE", exception="예외")
        parent = _knowledge("PRINCIPLE")
        proposal = _proposal("EXCEPTION", "예외")
        relation = _relation(
            proposal,
            parent,
            "HAS_EXCEPTION",
        )
        wrong = _knowledge("PRINCIPLE")
        match = SimpleNamespace(
            knowledge=wrong,
            match_type="SEMANTIC",
        )

        with patch(
            "app.services.knowledge_graph_policy_service."
            "find_duplicate_active_knowledge",
            return_value=match,
        ):
            with self.assertRaises(KnowledgeGraphPolicyViolation):
                build_knowledge_graph_policy_plan(
                    db=SimpleNamespace(),
                    synthesis=synthesis,
                    candidate=candidate,
                    proposals=[proposal],
                    targets=[parent],
                    relations=[relation],
                )

    def test_add_exception_without_explicit_candidate_exception_is_rejected(self):
        synthesis = _synthesis("ADD_EXCEPTION")
        candidate = _candidate("PRINCIPLE", exception=None)
        parent = _knowledge("PRINCIPLE")
        proposal = _proposal("EXCEPTION", "AI가 만든 예외")
        relation = _relation(
            proposal,
            parent,
            "HAS_EXCEPTION",
        )

        with self.assertRaises(KnowledgeGraphPolicyViolation):
            build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[parent],
                relations=[relation],
            )

    def test_cross_type_version_is_rejected_before_mutation(self):
        synthesis = _synthesis("ENRICH")
        candidate = _candidate("PRINCIPLE")
        target = _knowledge("EXCEPTION")
        proposal = _proposal("PRINCIPLE")

        with self.assertRaises(KnowledgeGraphPolicyViolation):
            build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[target],
                relations=[],
            )

    def test_version_no_material_change_reuses_target(self):
        synthesis = _synthesis("ENRICH")
        candidate = _candidate("PRINCIPLE")
        target = _knowledge("PRINCIPLE")
        proposal = _proposal("PRINCIPLE")
        material = SimpleNamespace(material_change=False)

        with patch(
            "app.services.knowledge_graph_policy_service."
            "find_duplicate_active_knowledge",
            return_value=None,
        ), patch(
            "app.services.knowledge_graph_policy_service."
            "assess_synthesized_unit_material_change",
            return_value=material,
        ):
            plan = build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[target],
                relations=[],
            )

        self.assertEqual(
            plan.action,
            GraphApplyAction.REUSE_TARGET,
        )
        self.assertIs(plan.version_target, target)
        self.assertFalse(plan.apply_proposed_relations)

    def test_material_same_type_change_creates_version(self):
        synthesis = _synthesis("SUPERSEDE")
        candidate = _candidate("PRINCIPLE")
        target = _knowledge("PRINCIPLE")
        proposal = _proposal("PRINCIPLE")
        material = SimpleNamespace(material_change=True)

        with patch(
            "app.services.knowledge_graph_policy_service."
            "find_duplicate_active_knowledge",
            return_value=None,
        ), patch(
            "app.services.knowledge_graph_policy_service."
            "assess_synthesized_unit_material_change",
            return_value=material,
        ):
            plan = build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[target],
                relations=[],
            )

        self.assertEqual(
            plan.action,
            GraphApplyAction.CREATE_VERSION,
        )
        self.assertIs(plan.version_target, target)

    def test_same_type_version_with_different_atomic_scope_is_rejected(self):
        """
        Same knowledge_type alone must never make a version chain.

        Actual Review Queue regression:
        - target EXCEPTION: emergency direct *read* is allowed
        - candidate EXCEPTION: direct INSERT/UPDATE/DELETE is forbidden

        They share topic/type but have different atomic scopes, so ENRICH must
        not absorb the write prohibition into a new version of the read
        exception.
        """
        synthesis = _synthesis("ENRICH")
        candidate = _candidate(
            "EXCEPTION",
            (
                "긴급 상황에서도 타 서비스 데이터베이스에 대해 "
                "INSERT, UPDATE, DELETE와 같은 변경 작업을 직접 "
                "수행하지 않는다."
            ),
        )
        candidate.context = {
            "domain": "MSA Architecture",
            "phase": "운영 및 장애 대응",
            "system": "타 서비스 데이터베이스 접근",
            "scope": "데이터 변경 작업",
            "time": "긴급 장애 대응 중",
            "tags": ["쓰기 금지", "데이터 무결성"],
            "constraints": [
                "INSERT 금지",
                "UPDATE 금지",
                "DELETE 금지",
            ],
        }

        target = _knowledge(
            "EXCEPTION",
            (
                "장애 대응 중 정상 경로로 확인할 수 없는 긴급 "
                "상황에서는 타 서비스 데이터베이스의 읽기 직접 "
                "조회를 예외적으로 허용한다."
            ),
        )
        target.context = {
            "domain": "MSA Architecture",
            "phase": "운영 및 장애 대응",
            "system": "타 서비스 데이터베이스 접근",
            "scope": "읽기 조회",
            "time": "장애 대응 중",
            "tags": ["장애 대응", "예외 접근"],
            "constraints": [],
        }

        proposal = _proposal(
            "EXCEPTION",
            (
                "장애 시 직접 읽기 조회는 허용하되 INSERT, UPDATE, "
                "DELETE 같은 직접 데이터 변경 작업은 수행하지 않는다."
            ),
        )

        with self.assertRaises(KnowledgeGraphPolicyViolation):
            build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[target],
                relations=[],
            )

    def test_merge_with_version_target_is_rejected(self):
        synthesis = _synthesis("MERGE")
        candidate = _candidate()
        proposal = _proposal()
        target = _knowledge()

        with self.assertRaises(KnowledgeGraphPolicyViolation):
            build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[target],
                relations=[],
            )

    def test_merge_supercedes_relation_is_rejected(self):
        synthesis = _synthesis("MERGE")
        candidate = _candidate()
        proposal = _proposal()
        target = _knowledge()
        relation = _relation(
            proposal,
            target,
            "SUPERSEDES",
        )

        with self.assertRaises(KnowledgeGraphPolicyViolation):
            build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[],
                relations=[relation],
            )

    def test_atomic_policy_rejects_multiple_synthesized_units(self):
        synthesis = _synthesis("KEEP_CONFLICT")
        candidate = _candidate()
        proposal_a = _proposal(index=0)
        proposal_b = _proposal(index=1)

        with self.assertRaises(KnowledgeGraphPolicyViolation):
            build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal_a, proposal_b],
                targets=[],
                relations=[],
            )


if __name__ == "__main__":
    unittest.main()
