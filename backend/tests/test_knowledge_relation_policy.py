import inspect
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import patch

import app.services.knowledge_synthesis_apply_service as apply_service
from app.services.knowledge_graph_policy_service import (
    GraphApplyAction,
    build_knowledge_graph_policy_plan,
)


def _candidate(
    statement: str,
    decision_then: str,
    if_conditions: list[str] | None = None,
):
    return SimpleNamespace(
        knowledge_type="DECISION_RULE",
        statement=statement,
        context={
            "domain": "MSA Architecture",
            "system": "서비스 간 연계",
            "scope": "서비스 간 데이터 조회 및 연계",
            "time": "평상시",
            "phase": None,
            "tags": [],
            "constraints": [],
        },
        decision_rule={
            "if_conditions": if_conditions or [],
            "then": decision_then,
            "unless": [],
        },
        rationale=None,
        exception=None,
    )


def _proposal(
    statement: str,
    decision_then: str,
    if_conditions: list[str] | None = None,
):
    return SimpleNamespace(
        synthesized_index=0,
        synthesis_unit_id=uuid.uuid4(),
        statement=statement,
        knowledge_type="DECISION_RULE",
        context={
            "domain": "MSA Architecture",
            "system": "서비스 간 연계",
            "scope": "서비스 간 데이터 조회 및 연계",
            "time": "평상시",
            "phase": None,
            "tags": [],
            "constraints": [],
        },
        decision_rule={
            "if_conditions": if_conditions or [],
            "then": decision_then,
            "unless": [],
        },
        rationale=None,
        exception=None,
    )


def _knowledge(
    statement: str,
    decision_then: str,
    if_conditions: list[str] | None = None,
):
    return SimpleNamespace(
        knowledge_id=uuid.uuid4(),
        knowledge_type="DECISION_RULE",
        statement=statement,
        context={
            "domain": "MSA Architecture",
            "system": "서비스 간 연계",
            "scope": "서비스 간 데이터 조회 및 연계",
            "time": "평상시",
            "phase": None,
            "tags": [],
            "constraints": [],
        },
        decision_rule={
            "if_conditions": if_conditions or [],
            "then": decision_then,
            "unless": [],
        },
        rationale=None,
        exception=None,
        version=1,
        root_knowledge_id=None,
        status="VERIFIED",
    )


def _synthesis(operation: str):
    return SimpleNamespace(
        operation=operation,
        mission_id=uuid.uuid4(),
    )


def _relation(
    proposal,
    target,
    relation_type="REFINES",
):
    return SimpleNamespace(
        synthesized_index=proposal.synthesized_index,
        target_knowledge_id=target.knowledge_id,
        relation_type=relation_type,
    )


class KnowledgeRelationPolicyTest(unittest.TestCase):
    def test_parallel_decision_rules_do_not_create_refines(self):
        """
        Actual Interview smoke-test regression:

        - immediate response -> API
        - async propagation / loose coupling -> Event

        These are parallel choices.  The Event rule must be created as an
        independent DECISION_RULE without Event --REFINES--> API.
        """

        synthesis = _synthesis("MERGE")
        candidate = _candidate(
            (
                "한 서비스의 상태 변경을 여러 서비스에 비동기로 "
                "전파해야 하거나 느슨한 결합이 중요한 경우에는 "
                "이벤트를 사용한다."
            ),
            "이벤트를 사용한다",
            [
                "한 서비스의 상태 변경을 여러 서비스에 비동기로 전파해야 한다",
                "느슨한 결합이 중요하다",
            ],
        )
        proposal = _proposal(
            candidate.statement,
            "이벤트를 사용한다",
            [
                "한 서비스의 상태 변경을 여러 서비스에 비동기로 전파해야 한다",
                "느슨한 결합이 중요하다",
            ],
        )
        api_rule = _knowledge(
            "서비스 간 연계에서 요청 즉시 응답이 필요하면 API를 사용한다.",
            "API를 사용한다",
            ["서비스 간 연계에서 요청 즉시 응답이 필요하다"],
        )
        relation = _relation(
            proposal,
            api_rule,
            "REFINES",
        )

        with patch(
            "app.services.knowledge_graph_policy_service."
            "find_duplicate_active_knowledge",
            return_value=None,
        ), patch(
            "app.services.knowledge_graph_policy_service."
            "_resolve_relation_target_map",
            return_value={
                api_rule.knowledge_id: api_rule,
            },
        ):
            plan = build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[],
                relations=[relation],
            )

        self.assertEqual(
            plan.action,
            GraphApplyAction.CREATE_NEW,
        )
        self.assertEqual(
            plan.relations_to_apply,
            (),
        )
        self.assertFalse(
            plan.apply_proposed_relations,
        )

    def test_same_outcome_decision_rule_can_keep_refines(self):
        """
        A narrower rule that preserves the same decision outcome can still
        refine an existing decision rule.
        """

        synthesis = _synthesis("MERGE")
        candidate = _candidate(
            "즉시 응답이 필요한 서비스 간 조회에는 API를 사용한다.",
            "API를 사용한다",
            ["즉시 응답이 필요한 서비스 간 요청"],
        )
        proposal = _proposal(
            candidate.statement,
            "API를 사용한다",
            ["즉시 응답이 필요한 서비스 간 요청"],
        )
        api_rule = _knowledge(
            "서비스 간 요청에는 API를 사용한다.",
            "API 사용",
            ["서비스 간 요청"],
        )
        relation = _relation(
            proposal,
            api_rule,
            "REFINES",
        )

        with patch(
            "app.services.knowledge_graph_policy_service."
            "find_duplicate_active_knowledge",
            return_value=None,
        ), patch(
            "app.services.knowledge_graph_policy_service."
            "_resolve_relation_target_map",
            return_value={
                api_rule.knowledge_id: api_rule,
            },
        ):
            plan = build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[],
                relations=[relation],
            )

        self.assertEqual(
            plan.action,
            GraphApplyAction.CREATE_NEW,
        )
        self.assertEqual(
            len(plan.relations_to_apply),
            1,
        )
        self.assertEqual(
            plan.relations_to_apply[0].relation_type,
            "REFINES",
        )
        self.assertTrue(
            plan.apply_proposed_relations,
        )

    def test_same_outcome_parallel_conditions_do_not_create_refines(self):
        """Same action alone is not enough when explicit IF slots differ."""

        synthesis = _synthesis("MERGE")
        candidate = _candidate(
            "배치 집계 작업에는 API를 사용한다.",
            "API를 사용한다",
            ["야간 배치 집계 작업이다"],
        )
        proposal = _proposal(
            candidate.statement,
            "API를 사용한다",
            ["야간 배치 집계 작업이다"],
        )
        target = _knowledge(
            "사용자 화면의 즉시 조회에는 API를 사용한다.",
            "API를 사용한다",
            ["사용자 화면의 즉시 조회이다"],
        )
        relation = _relation(
            proposal,
            target,
            "REFINES",
        )

        with patch(
            "app.services.knowledge_graph_policy_service."
            "find_duplicate_active_knowledge",
            return_value=None,
        ), patch(
            "app.services.knowledge_graph_policy_service."
            "_resolve_relation_target_map",
            return_value={
                target.knowledge_id: target,
            },
        ):
            plan = build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[],
                relations=[relation],
            )

        self.assertEqual(
            plan.relations_to_apply,
            (),
        )

    def test_exception_pair_drops_refines_in_favor_of_has_exception(self):
        """
        Actual frontend regression:

        EXCEPTION was approved first.  When the PRINCIPLE was approved later,
        AI proposed PRINCIPLE --REFINES--> EXCEPTION while post-apply
        reconciliation correctly inferred PRINCIPLE --HAS_EXCEPTION-->
        EXCEPTION.  The generic REFINES edge must be filtered centrally so the
        final pair has only the canonical exception relation.
        """

        synthesis = _synthesis("MERGE")

        candidate = SimpleNamespace(
            knowledge_type="PRINCIPLE",
            statement=(
                "평상시 서비스 간 데이터 조회나 변경은 다른 서비스의 "
                "데이터베이스에 직접 접근하지 않고 API 또는 이벤트를 "
                "통해 처리한다."
            ),
            context={
                "tags": [
                    "Database per Service",
                    "API",
                    "이벤트",
                    "직접 DB 접근 금지",
                ],
                "time": None,
                "phase": "평상시 운영",
                "scope": "서비스 간 데이터 조회·변경",
                "domain": "MSA Architecture",
                "system": "서비스 간 데이터 접근 및 통신",
                "project": None,
                "constraints": [],
            },
            decision_rule=None,
            rationale=None,
            exception=None,
        )

        proposal = SimpleNamespace(
            synthesized_index=0,
            synthesis_unit_id=uuid.uuid4(),
            statement=candidate.statement,
            knowledge_type="PRINCIPLE",
            context=candidate.context,
            decision_rule=None,
            rationale=None,
            exception=None,
        )

        exception = SimpleNamespace(
            knowledge_id=uuid.uuid4(),
            knowledge_type="EXCEPTION",
            statement=(
                "초기 Migration 단계에서 서비스 경계가 아직 완전히 "
                "분리되지 않아 즉시 Database per Service 구조로 전환하기 "
                "어려운 경우에 한해 Shared DB 직접 접근을 한시적인 "
                "예외로 허용한다."
            ),
            context={
                "tags": [
                    "Migration",
                    "Shared DB",
                    "Database per Service",
                    "서비스 경계",
                ],
                "time": "한시적",
                "phase": "초기 Migration",
                "scope": "서비스 경계 및 데이터베이스 구조",
                "domain": "MSA Architecture",
                "system": "Database per Service / Shared DB",
                "project": None,
                "constraints": [
                    "서비스 경계가 아직 완전히 분리되지 않음",
                    "즉시 Database per Service 구조로 전환하기 어려움",
                ],
            },
            decision_rule=None,
            rationale=None,
            exception=None,
            version=1,
            root_knowledge_id=None,
            status="VERIFIED",
        )

        relation = _relation(
            proposal,
            exception,
            "REFINES",
        )

        with patch(
            "app.services.knowledge_graph_policy_service."
            "find_duplicate_active_knowledge",
            return_value=None,
        ), patch(
            "app.services.knowledge_graph_policy_service."
            "_resolve_relation_target_map",
            return_value={
                exception.knowledge_id: exception,
            },
        ):
            plan = build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[],
                relations=[relation],
            )

        self.assertEqual(
            plan.action,
            GraphApplyAction.CREATE_NEW,
        )
        self.assertEqual(
            plan.relations_to_apply,
            (),
        )

    def test_exception_pair_drops_supports_in_favor_of_has_exception(self):
        """HAS_EXCEPTION also dominates generic SUPPORTS for the same pair."""

        synthesis = _synthesis("MERGE")

        candidate = SimpleNamespace(
            knowledge_type="PRINCIPLE",
            statement=(
                "평상시 서비스 간 데이터 조회는 타 서비스 DB에 직접 "
                "접근하지 않고 API 또는 이벤트를 사용한다."
            ),
            context={
                "domain": "MSA Architecture",
                "scope": "서비스 간 데이터 접근",
                "system": "Database per Service",
                "phase": "평상시 운영",
                "tags": ["API", "이벤트", "Database per Service"],
                "constraints": ["직접 DB 접근 금지"],
            },
            decision_rule=None,
            rationale=None,
            exception=None,
        )
        proposal = SimpleNamespace(
            synthesized_index=0,
            synthesis_unit_id=uuid.uuid4(),
            statement=candidate.statement,
            knowledge_type="PRINCIPLE",
            context=candidate.context,
            decision_rule=None,
            rationale=None,
            exception=None,
        )
        exception = SimpleNamespace(
            knowledge_id=uuid.uuid4(),
            knowledge_type="EXCEPTION",
            statement=(
                "초기 Migration에서 서비스 경계 미분리 시 Shared DB "
                "직접 접근을 한시적으로 허용한다."
            ),
            context={
                "domain": "MSA Architecture",
                "scope": "서비스 간 데이터 접근",
                "system": "Shared DB / Database per Service",
                "phase": "초기 Migration",
                "tags": ["Shared DB", "Database per Service", "직접 접근"],
                "constraints": ["서비스 경계 미분리", "한시적 허용"],
            },
            decision_rule=None,
            rationale=None,
            exception=None,
            version=1,
            root_knowledge_id=None,
            status="VERIFIED",
        )
        relation = _relation(
            proposal,
            exception,
            "SUPPORTS",
        )

        with patch(
            "app.services.knowledge_graph_policy_service."
            "find_duplicate_active_knowledge",
            return_value=None,
        ), patch(
            "app.services.knowledge_graph_policy_service."
            "_resolve_relation_target_map",
            return_value={exception.knowledge_id: exception},
        ):
            plan = build_knowledge_graph_policy_plan(
                db=SimpleNamespace(),
                synthesis=synthesis,
                candidate=candidate,
                proposals=[proposal],
                targets=[],
                relations=[relation],
            )

        self.assertEqual(plan.relations_to_apply, ())

    def test_version_predecessor_semantic_edges_are_filtered_centrally(self):
        """
        CREATE_VERSION owns exactly one canonical predecessor edge:
        new --SUPERSEDES--> old.

        Raw AI REFINES/SUPPORTS/SUPERSEDES proposals to that same predecessor
        must not survive the central relation policy.
        """

        synthesis = _synthesis("ENRICH")
        candidate = _candidate(
            "즉시 응답이 필요한 서비스 간 조회에는 API를 사용한다.",
            "API를 사용한다",
        )
        proposal = _proposal(
            "즉시 응답이 필요한 서비스 간 조회에는 인증된 API를 사용한다.",
            "API를 사용한다",
        )
        target = _knowledge(
            "즉시 응답이 필요한 서비스 간 조회에는 API를 사용한다.",
            "API를 사용한다",
        )
        relation = _relation(
            proposal,
            target,
            "REFINES",
        )
        material = SimpleNamespace(
            material_change=True,
        )

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
                relations=[relation],
            )

        self.assertEqual(
            plan.action,
            GraphApplyAction.CREATE_VERSION,
        )
        self.assertEqual(
            plan.relations_to_apply,
            (),
        )

    def test_apply_service_consumes_only_canonical_relation_plans(self):
        source = inspect.getsource(
            apply_service.validate_and_apply_synthesis
        )

        self.assertIn(
            "for relation_plan in policy_plan.relations_to_apply:",
            source,
        )
        self.assertNotIn(
            "if policy_plan.apply_proposed_relations",
            source,
        )


if __name__ == "__main__":
    unittest.main()
