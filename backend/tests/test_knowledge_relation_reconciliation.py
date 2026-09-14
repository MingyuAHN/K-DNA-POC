import inspect
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import patch

import app.services.knowledge_synthesis_apply_service as apply_service
from app.services.knowledge_graph_policy_service import (
    assess_exception_parent_relation,
    build_post_apply_relation_reconciliation_plans,
)


def _knowledge(
    knowledge_type: str,
    statement: str,
    *,
    mission_id=None,
    context=None,
    decision_rule=None,
    exception=None,
):
    return SimpleNamespace(
        knowledge_id=uuid.uuid4(),
        mission_id=mission_id or uuid.uuid4(),
        knowledge_type=knowledge_type,
        statement=statement,
        context=context or {},
        decision_rule=decision_rule,
        rationale=None,
        exception=exception,
        status="VERIFIED",
        version=1,
        root_knowledge_id=None,
        supersedes_id=None,
    )


def _frontend_principle(mission_id):
    return _knowledge(
        "PRINCIPLE",
        (
            "서비스 간 데이터 조회나 변경은 다른 서비스의 데이터베이스에 "
            "직접 접근하지 않고 API 또는 이벤트를 통해 처리한다."
        ),
        mission_id=mission_id,
        context={
            "tags": ["API", "이벤트", "서비스 결합도", "데이터 접근"],
            "time": "평상시",
            "phase": None,
            "scope": "서비스 간 데이터 조회 및 변경",
            "domain": "MSA Architecture",
            "system": None,
            "project": None,
            "constraints": [
                "다른 서비스의 데이터베이스에 직접 접근하지 않음"
            ],
        },
    )


def _frontend_exception(mission_id):
    return _knowledge(
        "EXCEPTION",
        (
            "초기 Migration 단계에서 서비스 경계가 아직 완전히 분리되지 않아 "
            "즉시 Database per Service 구조로 전환하기 어려운 경우에만 "
            "Shared DB 직접 접근을 한시적으로 허용할 수 있다."
        ),
        mission_id=mission_id,
        context={
            "tags": [
                "Shared DB",
                "직접 접근",
                "서비스 경계",
                "Database per Service",
                "Migration",
            ],
            "time": "초기 Migration 단계",
            "phase": "초기 Migration",
            "scope": "서비스 간 데이터 접근",
            "domain": "MSA Architecture",
            "system": "Shared DB 및 Database per Service",
            "project": None,
            "constraints": [
                "서비스 경계가 아직 완전히 분리되지 않음",
                "즉시 Database per Service 구조로 전환하기 어려움",
                "한시적 허용",
            ],
        },
        exception=(
            "서비스 경계가 완전히 분리되었거나 즉시 Database per Service "
            "구조로 전환할 수 있는 경우에는 이 예외를 적용하지 않는다."
        ),
    )


class KnowledgeRelationReconciliationTest(unittest.TestCase):
    def test_actual_frontend_case_is_safe_has_exception_relation(self):
        mission_id = uuid.uuid4()
        parent = _frontend_principle(mission_id)
        exception = _frontend_exception(mission_id)

        assessment = assess_exception_parent_relation(
            parent=parent,
            exception=exception,
        )

        self.assertTrue(assessment.compatible)
        self.assertGreaterEqual(assessment.score, 5.0)

    def test_principle_created_after_exception_reconciles_relation(self):
        """Actual bug: EXCEPTION approved first, PRINCIPLE approved last."""

        mission_id = uuid.uuid4()
        parent = _frontend_principle(mission_id)
        exception = _frontend_exception(mission_id)

        with patch(
            "app.services.knowledge_graph_policy_service."
            "_load_active_verified_knowledge",
            return_value=[exception, parent],
        ):
            plans = build_post_apply_relation_reconciliation_plans(
                db=SimpleNamespace(),
                mission_id=mission_id,
                changed_knowledge=parent,
            )

        self.assertEqual(len(plans), 1)
        self.assertEqual(
            plans[0].source_knowledge_id,
            parent.knowledge_id,
        )
        self.assertEqual(
            plans[0].target_knowledge_id,
            exception.knowledge_id,
        )
        self.assertEqual(
            plans[0].relation_type,
            "HAS_EXCEPTION",
        )

    def test_exception_created_after_principle_reconciles_same_relation(self):
        """Review order must not change the final graph."""

        mission_id = uuid.uuid4()
        parent = _frontend_principle(mission_id)
        exception = _frontend_exception(mission_id)

        with patch(
            "app.services.knowledge_graph_policy_service."
            "_load_active_verified_knowledge",
            return_value=[parent, exception],
        ):
            plans = build_post_apply_relation_reconciliation_plans(
                db=SimpleNamespace(),
                mission_id=mission_id,
                changed_knowledge=exception,
            )

        self.assertEqual(len(plans), 1)
        self.assertEqual(
            (
                plans[0].source_knowledge_id,
                plans[0].target_knowledge_id,
                plans[0].relation_type,
            ),
            (
                parent.knowledge_id,
                exception.knowledge_id,
                "HAS_EXCEPTION",
            ),
        )

    def test_restrictive_exception_is_not_auto_attached(self):
        """An EXCEPTION-typed prohibition is not a permissive exception edge."""

        mission_id = uuid.uuid4()
        parent = _frontend_principle(mission_id)
        restrictive_exception = _knowledge(
            "EXCEPTION",
            (
                "긴급 상황에서도 타 서비스 데이터베이스에 대해 INSERT, "
                "UPDATE, DELETE와 같은 변경 작업을 직접 수행하지 않는다."
            ),
            mission_id=mission_id,
            context={
                "domain": "MSA Architecture",
                "scope": "서비스 간 데이터 접근",
                "system": "타 서비스 데이터베이스 접근",
                "tags": ["쓰기 금지", "긴급 접근"],
                "constraints": ["직접 변경 작업 금지"],
            },
        )

        assessment = assess_exception_parent_relation(
            parent=parent,
            exception=restrictive_exception,
        )

        self.assertFalse(assessment.compatible)

    def test_unrelated_permissive_exception_is_not_auto_attached(self):
        mission_id = uuid.uuid4()
        parent = _frontend_principle(mission_id)
        unrelated = _knowledge(
            "EXCEPTION",
            "긴급 배포 시 승인된 담당자는 배포 동결을 한시적으로 해제할 수 있다.",
            mission_id=mission_id,
            context={
                "domain": "MSA Architecture",
                "scope": "배포 승인",
                "system": "배포 파이프라인",
                "tags": ["긴급 배포", "배포 동결"],
                "constraints": ["승인된 담당자만 허용"],
            },
        )

        assessment = assess_exception_parent_relation(
            parent=parent,
            exception=unrelated,
        )

        self.assertFalse(assessment.compatible)

    def test_decision_rule_is_not_guessed_as_exception_parent(self):
        """Automatic backfill stays conservative; explicit synthesis can link it."""

        mission_id = uuid.uuid4()
        exception = _frontend_exception(mission_id)
        decision_rule = _knowledge(
            "DECISION_RULE",
            "운영 편의만을 이유로 Shared DB 직접 접근을 계속 유지해서는 안 된다.",
            mission_id=mission_id,
            context={
                "domain": "MSA Architecture",
                "scope": "서비스 간 데이터 접근 지속 여부",
                "system": "Shared DB",
                "time": "초기 Migration 이후 운영 단계",
                "tags": ["Shared DB", "운영 편의", "직접 접근"],
                "constraints": ["운영 편의만으로 지속 유지 금지"],
            },
            decision_rule={
                "if_conditions": [
                    "Shared DB 직접 접근을 유지하는 유일한 이유가 운영 편의임"
                ],
                "then": "Shared DB 직접 접근을 계속 유지하지 않는다.",
                "unless": [],
            },
        )

        with patch(
            "app.services.knowledge_graph_policy_service."
            "_load_active_verified_knowledge",
            return_value=[decision_rule, exception],
        ):
            plans = build_post_apply_relation_reconciliation_plans(
                db=SimpleNamespace(),
                mission_id=mission_id,
                changed_knowledge=decision_rule,
            )

        self.assertEqual(plans, ())

    def test_apply_runs_reconciliation_only_for_created_knowledge(self):
        source = inspect.getsource(
            apply_service.validate_and_apply_synthesis
        )

        self.assertIn(
            "if policy_plan.creates_knowledge:",
            source,
        )
        self.assertIn(
            "build_post_apply_relation_reconciliation_plans(",
            source,
        )
        self.assertIn(
            "relation_plan.source_knowledge_id",
            source,
        )
        self.assertIn(
            "relation_plan.target_knowledge_id",
            source,
        )


if __name__ == "__main__":
    unittest.main()
