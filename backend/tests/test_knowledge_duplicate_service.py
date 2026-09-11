import unittest
from types import SimpleNamespace

from app.services.knowledge_duplicate_service import (
    _build_metrics,
    _expresses_insufficient_condition,
    _has_polarity_mismatch,
    _is_contained_insufficiency_duplicate,
    _tag_overlap_count,
)


def _candidate(
    statement: str,
    *,
    context: dict | None = None,
    knowledge_type: str = "PRINCIPLE",
):
    return SimpleNamespace(
        statement=statement,
        context=context or {},
        knowledge_type=knowledge_type,
    )


def _knowledge(
    statement: str,
    *,
    context: dict | None = None,
    knowledge_type: str = "DECISION_RULE",
):
    return SimpleNamespace(
        statement=statement,
        context=context or {},
        knowledge_type=knowledge_type,
    )


class KnowledgeDuplicatePolarityTest(
    unittest.TestCase,
):
    """
    Duplicate Suppression polarity/context 회귀 테스트.

    목표:
    - 보조적인 insufficiency 표현 때문에 같은 방향의 지식을
      반대 의미로 오판하지 않는다.
    - 실제 핵심 결론이 뒤집히는 경우에는 mismatch로 막는다.
    - 같은 의미의 Context가 tags / constraints에 다르게 배치되어도
      구조적 support를 잃지 않는다.
    """

    def test_same_rule_with_supporting_negation_is_not_mismatch(
        self,
    ):
        knowledge = _knowledge(
            (
                "물리적 DB 분리는 데이터 소유권과 "
                "직접 쓰기 의존성 정리만으로 결정하지 않으며, "
                "서비스 단위의 독립 배포와 독립 장애 대응이 "
                "가능한 운영 독립성을 확보한 후 진행한다."
            )
        )

        candidate = _candidate(
            (
                "서비스가 다른 서비스와 독립적으로 배포되고 "
                "장애 발생 시 자체적으로 대응할 수 있는 "
                "운영 자립성을 확보한 경우에 "
                "물리적 DB 분리를 진행한다."
            )
        )

        self.assertFalse(
            _has_polarity_mismatch(
                candidate=candidate,
                knowledge=knowledge,
            )
        )

    def test_insufficient_condition_paraphrase_is_not_mismatch(
        self,
    ):
        knowledge = _knowledge(
            (
                "데이터 소유권과 서비스 간 직접 쓰기 "
                "의존성만으로 DB 분리를 결정하지 않는다."
            )
        )

        candidate = _candidate(
            (
                "데이터 소유권과 서비스 간 직접 쓰기 "
                "의존성만으로는 DB 분리 여부를 "
                "판단하기에 부족하다."
            )
        )

        self.assertFalse(
            _has_polarity_mismatch(
                candidate=candidate,
                knowledge=knowledge,
            )
        )

    def test_actual_e2e_v3_and_positive_conclusion_is_not_mismatch(
        self,
    ):
        """
        실제 Clean E2E에서 v3 -> v4/v5를 만든 케이스.

        기존 v3는 'A만으로 판단하지 않는다'는 insufficiency와
        'B가 확보되면 진행한다'는 결론을 함께 가진다.
        신규 Candidate는 B 결론만 다시 표현한다.

        둘은 반대 polarity가 아니다.
        """
        knowledge = _knowledge(
            (
                "서비스별 물리적 DB 분리는 데이터 소유권과 "
                "서비스 간 직접 쓰기 의존성만으로 판단하지 않는다. "
                "해당 서비스가 다른 서비스와 독립적으로 배포될 수 있고 "
                "장애 발생 시 자체적으로 대응할 수 있어 운영 자립성을 "
                "확보한 경우에 진행한다."
            )
        )

        candidate = _candidate(
            (
                "서비스별 물리적 DB 분리는 해당 서비스가 다른 서비스와 "
                "독립적으로 배포될 수 있고 장애 발생 시 자체적으로 "
                "대응할 수 있는 운영 자립성을 확보한 경우에 "
                "진행하는 것이 적절하다."
            )
        )

        self.assertFalse(
            _has_polarity_mismatch(
                candidate=candidate,
                knowledge=knowledge,
            )
        )


    def test_actual_v5_justification_negation_is_insufficiency(
        self,
    ):
        """
        실제 v5의 '정당화할 수 없다'는 핵심 결론의 부정이 아니라
        'A만으로는 충분하지 않다'는 insufficiency 표현이다.
        """
        knowledge = _knowledge(
            (
                "서비스별 물리적 DB 분리는 데이터 소유권과 서비스 간 "
                "직접 쓰기 의존성만으로는 정당화할 수 없으며, "
                "해당 서비스가 다른 서비스와 독립적으로 배포되고 "
                "장애 발생 시 자체적으로 대응할 수 있어 운영 자립성을 "
                "확보한 경우에 진행하는 것이 적절하다."
            )
        )

        candidate = _candidate(
            (
                "서비스별 물리적 DB 분리는 서비스의 독립 배포 능력과 "
                "장애 발생 시 자체 대응이 가능한 운영 자립성이 "
                "확보된 이후에 진행하는 것이 적절하다."
            ),
            knowledge_type="DECISION_RULE",
        )

        self.assertTrue(
            _expresses_insufficient_condition(knowledge.statement)
        )
        self.assertFalse(
            _has_polarity_mismatch(
                candidate=candidate,
                knowledge=knowledge,
            )
        )

    def test_actual_v5_short_insufficiency_candidate_is_contained_duplicate(
        self,
    ):
        """
        실제 E2E의 두 번째 Candidate는 기존 v5가 이미 포함하고 있는
        '소유권/직접 쓰기 정리만으로는 부족'이라는 sub-claim이다.
        별도 Version을 만들지 않고 Duplicate로 억제해야 한다.
        """
        knowledge = _knowledge(
            (
                "서비스별 물리적 DB 분리는 데이터 소유권과 서비스 간 "
                "직접 쓰기 의존성만으로는 정당화할 수 없으며, "
                "해당 서비스가 다른 서비스와 독립적으로 배포되고 "
                "장애 발생 시 자체적으로 대응할 수 있어 운영 자립성을 "
                "확보한 경우에 진행하는 것이 적절하다."
            ),
            context={
                "tags": [
                    "DB 분리",
                    "운영 자립성",
                    "배포 독립성",
                    "장애 대응",
                ],
                "constraints": [
                    "데이터 소유권",
                    "서비스 간 직접 쓰기 의존성",
                    "독립 배포 가능성",
                    "장애 대응을 위한 운영 자립성",
                ],
            },
            knowledge_type="DECISION_RULE",
        )

        candidate = _candidate(
            (
                "데이터 소유권이 정리되고 서비스 간 직접 쓰기 의존성이 "
                "제거된 것만으로는 서비스별 물리적 DB 분리 준비가 "
                "완료되었다고 판단하지 않는다."
            ),
            context={
                "tags": [
                    "데이터 소유권",
                    "직접 쓰기 의존성",
                    "DB 분리 준비",
                ],
                "constraints": [],
            },
            knowledge_type="PRINCIPLE",
        )

        metrics = _build_metrics(
            candidate=candidate,
            knowledge=knowledge,
        )

        self.assertTrue(
            _expresses_insufficient_condition(candidate.statement)
        )
        self.assertTrue(
            _expresses_insufficient_condition(knowledge.statement)
        )
        self.assertTrue(
            _is_contained_insufficiency_duplicate(
                candidate=candidate,
                knowledge=knowledge,
                metrics=metrics,
            )
        )

    def test_direct_positive_negative_rule_is_mismatch(
        self,
    ):
        knowledge = _knowledge(
            "운영 독립성이 확보되면 물리적 DB를 분리한다."
        )

        candidate = _candidate(
            "운영 독립성이 확보되어도 물리적 DB를 분리하지 않는다."
        )

        self.assertTrue(
            _has_polarity_mismatch(
                candidate=candidate,
                knowledge=knowledge,
            )
        )

    def test_allow_and_prohibit_are_mismatch(
        self,
    ):
        knowledge = _knowledge(
            "레거시 전환 기간에는 Shared DB 사용을 허용한다."
        )

        candidate = _candidate(
            "레거시 전환 기간에도 Shared DB 사용을 금지한다."
        )

        self.assertTrue(
            _has_polarity_mismatch(
                candidate=candidate,
                knowledge=knowledge,
            )
        )

    def test_insufficient_vs_explicit_sufficient_is_mismatch(
        self,
    ):
        """
        'A만으로 판단하지 않는다'와 'A만으로 판단한다'는
        실제로 서로 반대되는 조건 판단이다.
        """
        knowledge = _knowledge(
            "데이터 소유권만으로 DB 분리를 판단하지 않는다."
        )

        candidate = _candidate(
            "데이터 소유권만으로 DB 분리를 판단한다."
        )

        self.assertTrue(
            _has_polarity_mismatch(
                candidate=candidate,
                knowledge=knowledge,
            )
        )

    def test_context_support_uses_tags_and_constraints(
        self,
    ):
        """
        AI가 같은 의미를 한쪽은 tags, 다른 쪽은 constraints에
        넣더라도 duplicate 구조 신호가 유지되어야 한다.
        """
        candidate = _candidate(
            "데이터 소유권과 직접 쓰기 의존성만으로는 부족하다.",
            context={
                "tags": [
                    "데이터 소유권",
                    "직접 쓰기 의존성",
                ],
                "constraints": [],
            },
        )

        knowledge = _knowledge(
            "운영 자립성이 확보된 후 DB 분리를 진행한다.",
            context={
                "tags": [
                    "DB 분리",
                    "운영 자립성",
                ],
                "constraints": [
                    "데이터 소유권",
                    "서비스 간 직접 쓰기 의존성",
                ],
            },
        )

        self.assertGreaterEqual(
            _tag_overlap_count(
                candidate=candidate,
                knowledge=knowledge,
            ),
            2,
        )


if __name__ == "__main__":
    unittest.main()
