from types import SimpleNamespace
import unittest

from app.services.knowledge_duplicate_service import (
    assess_synthesized_unit_material_change,
)


def make_unit(
    statement: str,
    knowledge_type: str = "DECISION_RULE",
    context: dict | None = None,
    decision_rule: dict | None = None,
    exception: str | None = None,
):
    return SimpleNamespace(
        statement=statement,
        knowledge_type=knowledge_type,
        context=context or {},
        decision_rule=decision_rule,
        exception=exception,
    )


class KnowledgeMaterialChangeGuardTest(unittest.TestCase):
    def test_wording_only_change_is_noop(self):
        target = make_unit(
            "서비스별 물리적 DB 분리는 데이터 소유권과 서비스 간 직접 쓰기 "
            "의존성만으로는 정당화할 수 없으며, 해당 서비스가 다른 서비스와 "
            "독립적으로 배포되고 장애 발생 시 자체적으로 대응할 수 있어 운영 "
            "자립성을 확보한 경우에 진행한다.",
            context={
                "domain": "MSA Architecture",
                "phase": "DB 분리 판단",
                "scope": "서비스별 물리적 DB 분리",
            },
        )
        proposal = make_unit(
            "서비스별 물리적 DB 분리는 데이터 소유권과 서비스 간 직접 쓰기 "
            "의존성만으로는 정당화할 수 없으며, 해당 서비스가 다른 서비스와 "
            "독립적으로 배포되고 장애 발생 시 자체적으로 대응할 수 있어 운영 "
            "자립성을 확보한 경우에 진행하는 것이 적절하다.",
            context={
                "domain": "MSA Architecture",
                "phase": "DB 분리 판단",
                "scope": "서비스별 물리적 DB 분리",
            },
        )

        result = assess_synthesized_unit_material_change(
            target=target,
            proposal=proposal,
            embedding_cache={},
        )

        self.assertFalse(result.material_change)

    def test_substantive_operational_conditions_are_material(self):
        target = make_unit(
            "서비스별 물리적 DB 분리는 데이터 소유권이 명확하고 서비스 간 직접 "
            "쓰기 의존성이 제거된 것만으로는 충분하지 않으며, 해당 서비스의 "
            "독립 배포와 운영 자립성이 확보되고 운영 전환 또는 운영 환경에서 "
            "장애 복구 절차가 검증된 경우에 진행한다.",
            context={
                "domain": "MSA Architecture",
                "scope": "DB 분리 의사결정",
            },
        )
        proposal = make_unit(
            "서비스별 물리적 DB 분리는 데이터 소유권이 명확하고 서비스 간 직접 "
            "쓰기 의존성이 제거된 것만으로는 충분하지 않으며, 독립 배포와 운영 "
            "자립성이 확보되고 데이터 동기화 실패 및 핵심 데이터 불일치의 탐지 "
            "기준·복구 절차가 사전에 정의되어야 하며, 실제 장애 복구 테스트에서 "
            "정상 복구가 확인된 이후에 진행한다.",
            context={
                "domain": "MSA Architecture",
                "scope": "DB 분리 의사결정",
                "constraints": [
                    "데이터 동기화 실패 탐지",
                    "핵심 데이터 불일치 탐지",
                    "복구 절차 사전 정의",
                    "실제 장애 복구 테스트 정상 복구",
                ],
            },
        )

        result = assess_synthesized_unit_material_change(
            target=target,
            proposal=proposal,
            embedding_cache={},
        )

        self.assertTrue(result.material_change)

    def test_opposite_polarity_is_material(self):
        target = make_unit(
            "불일치가 허용 기준을 초과하면 기존 DB로 롤백한다."
        )
        proposal = make_unit(
            "불일치가 허용 기준을 초과해도 기존 DB로 롤백해서는 안 된다."
        )

        result = assess_synthesized_unit_material_change(
            target=target,
            proposal=proposal,
            embedding_cache={},
        )

        self.assertTrue(result.material_change)

    def test_added_exception_is_material(self):
        target = make_unit(
            "서비스별 DB 분리를 진행한다.",
            exception=None,
        )
        proposal = make_unit(
            "서비스별 DB 분리를 진행한다.",
            exception="강한 원자적 일관성이 필요한 경우에는 보류한다.",
        )

        result = assess_synthesized_unit_material_change(
            target=target,
            proposal=proposal,
            embedding_cache={},
        )

        self.assertTrue(result.material_change)

    def test_knowledge_type_change_is_material(self):
        target = make_unit(
            "장애 복구 절차가 검증되지 않으면 DB 분리를 보류한다.",
            knowledge_type="EXCEPTION",
        )
        proposal = make_unit(
            "장애 복구 절차가 검증되지 않으면 DB 분리를 보류한다.",
            knowledge_type="PRINCIPLE",
        )

        result = assess_synthesized_unit_material_change(
            target=target,
            proposal=proposal,
            embedding_cache={},
        )

        self.assertTrue(result.material_change)

    def test_decision_rule_change_is_material(self):
        target = make_unit(
            "불일치가 허용 기준을 초과하면 롤백한다.",
            decision_rule={
                "if_conditions": ["불일치가 허용 기준 초과"],
                "then": "기존 DB로 롤백한다.",
                "unless": [],
            },
        )
        proposal = make_unit(
            "불일치가 허용 기준을 초과하면 롤백한다.",
            decision_rule={
                "if_conditions": ["불일치가 허용 기준 초과"],
                "then": "쓰기 경로를 차단하고 수동 복구한다.",
                "unless": [],
            },
        )

        result = assess_synthesized_unit_material_change(
            target=target,
            proposal=proposal,
            embedding_cache={},
        )

        self.assertTrue(result.material_change)


if __name__ == "__main__":
    unittest.main()
