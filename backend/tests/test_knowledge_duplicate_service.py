import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import patch

from app.services.knowledge_duplicate_service import (
    _build_metrics,
    _expresses_insufficient_condition,
    _has_polarity_mismatch,
    _candidate_exception_signal_is_covered_by_knowledge,
    _is_contained_insufficiency_duplicate,
    _is_exception_decision_semantic_noop,
    _is_exception_decision_strong_lexical_noop,
    _is_exception_decision_conditional_allowance_noop,
    _is_semantic_duplicate,
    _tag_overlap_count,
    _types_are_exception_decision_noop_compatible,
    find_duplicate_active_knowledge,
)


def _candidate(
    statement: str,
    *,
    context: dict | None = None,
    knowledge_type: str = "PRINCIPLE",
    exception: str | None = None,
):
    return SimpleNamespace(
        statement=statement,
        context=context or {},
        knowledge_type=knowledge_type,
        exception=exception,
    )


def _knowledge(
    statement: str,
    *,
    context: dict | None = None,
    knowledge_type: str = "DECISION_RULE",
    exception: str | None = None,
):
    return SimpleNamespace(
        statement=statement,
        context=context or {},
        knowledge_type=knowledge_type,
        exception=exception,
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

    def test_actual_graph_fix_short_exception_is_semantic_subclaim_duplicate(
        self,
    ):
        """
        Graph Fix E2E에서 Turn1의 짧은 EXCEPTION Candidate가
        Turn2에서 이미 VERIFIED된 더 풍부한 EXCEPTION의 의미를
        다시 진술하는 경우다.

        두 문장은 한국어 조사/어순과 정보량 차이 때문에 lexical
        combined score가 낮을 수 있지만, 동일 type + 짧은 sub-claim
        + 강한 tags/constraints overlap + semantic similarity가
        충분하면 Duplicate로 억제해야 한다.
        """
        knowledge = _knowledge(
            (
                "평상시에는 서비스 간 데이터 확인에 API 또는 이벤트 "
                "기반 접근을 사용한다. 다만 운영 중 장애로 API나 "
                "이벤트를 통한 확인이 불가능하거나 정상 경로를 "
                "기다리면 복구가 지연되는 긴급 상황에서는 타 서비스 "
                "데이터베이스의 직접 조회를 일시적인 공식 예외로 "
                "허용할 수 있다."
            ),
            context={
                "tags": [
                    "cross-service-database-access",
                    "incident-response",
                    "temporary-exception",
                ],
                "constraints": [
                    (
                        "API 또는 이벤트를 통한 확인이 불가능해야 함 "
                        "또는 정상 경로 대기로 복구가 지연되는 "
                        "긴급 상황이어야 함"
                    ),
                    "직접 조회는 일시적으로 허용",
                ],
            },
            knowledge_type="EXCEPTION",
        )

        candidate = _candidate(
            (
                "장애 원인 분석이나 긴급 복구처럼 API만으로 필요한 "
                "데이터를 확인하기 어려운 경우에는 다른 서비스의 "
                "데이터베이스를 직접 조회할 수 있다."
            ),
            context={
                "tags": [
                    "장애 대응",
                    "긴급 복구",
                    "직접 조회",
                ],
                "constraints": [
                    "API만으로 필요한 데이터 확인이 어려운 경우",
                ],
            },
            knowledge_type="EXCEPTION",
        )

        metrics = _build_metrics(
            candidate=candidate,
            knowledge=knowledge,
        )

        is_duplicate, combined_score = (
            _is_semantic_duplicate(
                metrics=metrics,
                semantic_similarity=0.90,
            )
        )

        # 기존 일반 combined threshold만 적용하면 이 케이스는
        # lexical 차이 때문에 0.70에 미달할 수 있다.
        self.assertLess(combined_score, 0.70)

        self.assertLessEqual(
            metrics.length_ratio,
            0.8,
        )
        self.assertGreaterEqual(
            metrics.tag_overlap_count,
            3,
        )
        self.assertTrue(is_duplicate)



    def test_actual_graph_fix_exception_decision_type_drift_is_noop(
        self,
    ):
        """
        Final Graph E2E Turn3 실제 케이스.

        기존 VERIFIED Knowledge는 EXCEPTION인데 AI가 같은 장애 예외
        규칙을 다음 Turn에서 DECISION_RULE로 분류했다. Type만 다를 뿐
        의미가 같은 경우에는 별도 Knowledge를 만들지 않아야 한다.
        """
        knowledge = _knowledge(
            (
                "평상시에는 API 또는 이벤트를 통한 확인을 사용하되, "
                "장애 대응 중 API나 이벤트를 통한 확인이 불가능하거나 "
                "정상 경로를 기다리면 복구가 지연되는 긴급 상황에서는 "
                "타 서비스 데이터베이스에 대한 읽기 직접 조회를 "
                "공식적인 예외로 허용한다."
            ),
            context={
                "tags": [
                    "장애 대응",
                    "예외 접근",
                    "서비스 간 데이터베이스 접근",
                ],
                "constraints": [
                    "API 또는 이벤트를 통한 확인이 불가능해야 함",
                    (
                        "정상 경로 대기 시 장애 복구가 지연되는 "
                        "긴급 상황이어야 함"
                    ),
                ],
            },
            knowledge_type="EXCEPTION",
            exception=None,
        )

        candidate = _candidate(
            (
                "장애 대응 중 API나 이벤트만으로 필요한 데이터를 "
                "확인하기 어렵거나 정상 경로를 기다리면 복구가 "
                "지연되는 긴급한 경우에는 타 서비스 데이터베이스의 "
                "직접 읽기 조회를 일시적인 예외로 허용한다."
            ),
            context={
                "tags": [
                    "장애 대응",
                    "타 서비스 DB",
                    "직접 조회",
                    "API",
                    "이벤트",
                    "예외 접근",
                ],
                "constraints": [
                    "직접 조회는 일시적인 예외여야 함",
                    (
                        "API나 이벤트 경로로 확인하기 어려운 "
                        "경우에 한정"
                    ),
                    (
                        "정상 경로 대기로 복구가 지연되는 "
                        "긴급 상황에 한정"
                    ),
                ],
            },
            knowledge_type="DECISION_RULE",
            exception=(
                "평상시에는 타 서비스 데이터베이스의 직접 조회를 "
                "허용하지 않는다."
            ),
        )

        self.assertTrue(
            _types_are_exception_decision_noop_compatible(
                candidate=candidate,
                knowledge=knowledge,
            )
        )

        self.assertTrue(
            _candidate_exception_signal_is_covered_by_knowledge(
                candidate=candidate,
                knowledge=knowledge,
            )
        )

        metrics = _build_metrics(
            candidate=candidate,
            knowledge=knowledge,
        )

        is_duplicate, _ = (
            _is_exception_decision_semantic_noop(
                metrics=metrics,
                semantic_similarity=0.90,
            )
        )

        self.assertTrue(is_duplicate)

    def test_actual_graph_fix_type_drift_duplicate_does_not_require_embedding(
        self,
    ):
        """
        실제 Final Graph E2E 실패 회귀 테스트.

        Candidate와 기존 EXCEPTION은 statement/context가 충분히 겹치는데도
        production에서는 embedding score 또는 embedding availability에 따라
        semantic type-drift no-op이 실패하면서 DECISION_RULE v2가 생성됐다.

        이 케이스는 강한 lexical/context 신호만으로 기존 EXCEPTION을
        재사용해야 하며, embedding 호출 자체가 없어도 동작해야 한다.
        """
        knowledge = _knowledge(
            (
                "평상시에는 API 또는 이벤트를 통한 확인을 사용하되, "
                "장애 대응 중 API나 이벤트를 통한 확인이 불가능하거나 "
                "정상 경로를 기다리면 복구가 지연되는 긴급 상황에서는 "
                "타 서비스 데이터베이스에 대한 읽기 직접 조회를 "
                "공식적인 예외로 허용한다."
            ),
            context={
                "tags": [
                    "장애 대응",
                    "예외 접근",
                    "서비스 간 데이터베이스 접근",
                ],
                "constraints": [
                    "API 또는 이벤트를 통한 확인이 불가능해야 함",
                    (
                        "정상 경로 대기 시 장애 복구가 지연되는 "
                        "긴급 상황이어야 함"
                    ),
                ],
                "phase": "운영 및 장애 대응",
                "domain": "MSA Architecture",
            },
            knowledge_type="EXCEPTION",
            exception=None,
        )
        knowledge.knowledge_id = uuid.uuid4()

        candidate = _candidate(
            (
                "장애 대응 중 API나 이벤트만으로 필요한 데이터를 "
                "확인하기 어렵거나 정상 경로를 기다리면 복구가 "
                "지연되는 긴급한 경우에는 타 서비스 데이터베이스의 "
                "직접 읽기 조회를 일시적인 예외로 허용한다."
            ),
            context={
                "tags": [
                    "장애 대응",
                    "타 서비스 DB",
                    "직접 조회",
                    "API",
                    "이벤트",
                    "예외 접근",
                ],
                "constraints": [
                    "직접 조회는 일시적인 예외여야 함",
                    (
                        "API나 이벤트 경로로 확인하기 어려운 "
                        "경우에 한정"
                    ),
                    (
                        "정상 경로 대기로 복구가 지연되는 "
                        "긴급 상황에 한정"
                    ),
                ],
                "phase": "운영 장애 대응",
                "domain": "MSA Architecture",
            },
            knowledge_type="DECISION_RULE",
            exception=(
                "평상시에는 타 서비스 데이터베이스의 직접 조회를 "
                "허용하지 않는다."
            ),
        )

        metrics = _build_metrics(
            candidate=candidate,
            knowledge=knowledge,
        )

        self.assertTrue(
            _is_exception_decision_strong_lexical_noop(metrics)
        )

        class _FakeQuery:
            def __init__(self, rows):
                self.rows = rows

            def filter(self, *args, **kwargs):
                return self

            def order_by(self, *args, **kwargs):
                return self

            def all(self):
                return self.rows

        class _FakeDB:
            def query(self, *args, **kwargs):
                return _FakeQuery([knowledge])

        with patch(
            "app.services.knowledge_duplicate_service._get_embedding_vectors",
            side_effect=AssertionError(
                "strong lexical type-drift no-op must not require embedding"
            ),
        ):
            match = find_duplicate_active_knowledge(
                db=_FakeDB(),
                mission_id=uuid.uuid4(),
                candidate=candidate,
            )

        self.assertIsNotNone(match)
        self.assertEqual(
            match.knowledge.knowledge_id,
            knowledge.knowledge_id,
        )
        self.assertEqual(
            match.match_type,
            "EXCEPTION_DECISION_TYPE_DRIFT_LEXICAL_NOOP",
        )


    def test_final_graph_turn4_type_drift_duplicate_reuses_exception_without_embedding(
        self,
    ):
        """
        실제 Final Graph Turn4 회귀 테스트.

        Turn3보다 paraphrase가 커져 기존 strong lexical threshold는
        소폭 밑돌지만, 양쪽 모두 동일한 조건부 허용 규칙이며
        Context support가 강하다. Embedding availability/score와 무관하게
        기존 VERIFIED EXCEPTION을 재사용해야 한다.
        """
        knowledge = _knowledge(
            (
                "평상시에는 API 또는 이벤트를 통한 확인을 사용하되, "
                "장애 대응 중 API나 이벤트를 통한 확인이 불가능하거나 "
                "정상 경로를 기다리면 복구가 지연되는 긴급 상황에서는 "
                "타 서비스 데이터베이스에 대한 읽기 직접 조회를 "
                "공식적인 예외로 허용한다."
            ),
            context={
                "tags": [
                    "장애 대응",
                    "예외 접근",
                    "서비스 간 데이터베이스 접근",
                ],
                "constraints": [
                    "API 또는 이벤트를 통한 확인이 불가능해야 함",
                    (
                        "정상 경로 대기 시 장애 복구가 지연되는 "
                        "긴급 상황이어야 함"
                    ),
                ],
                "phase": "운영 및 장애 대응",
                "domain": "MSA Architecture",
            },
            knowledge_type="EXCEPTION",
            exception=None,
        )
        knowledge.knowledge_id = uuid.uuid4()

        candidate = _candidate(
            (
                "운영 장애 중 API나 이벤트로 필요한 정보를 확인할 수 "
                "없거나 정상 절차를 기다리면 복구가 지연되는 긴급 "
                "상황에는 타 서비스 데이터베이스의 읽기 조회를 "
                "일시적으로 허용할 수 있다."
            ),
            context={
                "tags": [
                    "장애 대응",
                    "서비스 간 데이터 접근",
                    "직접 DB 조회",
                ],
                "constraints": [
                    "일시적인 예외",
                ],
                "phase": "운영 장애 대응",
                "domain": "MSA Architecture",
            },
            knowledge_type="DECISION_RULE",
            exception=None,
        )

        metrics = _build_metrics(
            candidate=candidate,
            knowledge=knowledge,
        )

        # "확인할 수 없거나"는 금지 결론이 아니라 조건부 허용 규칙의
        # 선행 조건이므로 기존 EXCEPTION의 "불가능하거나"와 polarity가
        # 반대라고 보면 안 된다.
        self.assertFalse(
            _has_polarity_mismatch(
                candidate=candidate,
                knowledge=knowledge,
            )
        )

        # Turn4는 기존 Turn3용 strong lexical gate를 실제로 소폭 밑돈다.
        self.assertFalse(
            _is_exception_decision_strong_lexical_noop(metrics)
        )
        self.assertTrue(
            _is_exception_decision_conditional_allowance_noop(
                candidate=candidate,
                knowledge=knowledge,
                metrics=metrics,
            )
        )

        class _FakeQuery:
            def __init__(self, rows):
                self.rows = rows

            def filter(self, *args, **kwargs):
                return self

            def order_by(self, *args, **kwargs):
                return self

            def all(self):
                return self.rows

        class _FakeDB:
            def query(self, *args, **kwargs):
                return _FakeQuery([knowledge])

        with patch(
            "app.services.knowledge_duplicate_service._get_embedding_vectors",
            side_effect=AssertionError(
                "Turn4 conditional type-drift no-op must not require embedding"
            ),
        ):
            match = find_duplicate_active_knowledge(
                db=_FakeDB(),
                mission_id=uuid.uuid4(),
                candidate=candidate,
            )

        self.assertIsNotNone(match)
        self.assertEqual(
            match.knowledge.knowledge_id,
            knowledge.knowledge_id,
        )
        self.assertEqual(
            match.match_type,
            "EXCEPTION_DECISION_TYPE_DRIFT_CONDITIONAL_NOOP",
        )


    def test_exception_and_distinct_decision_rule_are_not_type_drift_noop(
        self,
    ):
        """
        EXCEPTION과 DECISION_RULE이라는 이유만으로 합치면 안 된다.
        '장애 시 직접 조회 허용'과 '장애 종료 후 권한 회수'는 서로
        관련되지만 독립적인 atomic Knowledge이므로 no-op이 아니다.
        """
        knowledge = _knowledge(
            (
                "장애 대응 중 API나 이벤트 확인이 불가능한 긴급 "
                "상황에서는 타 서비스 데이터베이스의 읽기 조회를 "
                "일시적 예외로 허용한다."
            ),
            context={
                "tags": [
                    "장애 대응",
                    "예외 접근",
                    "직접 조회",
                ],
                "constraints": [
                    "긴급 상황에서만 허용",
                ],
            },
            knowledge_type="EXCEPTION",
        )

        candidate = _candidate(
            (
                "장애 대응이 종료되면 타 서비스 데이터베이스의 "
                "임시 직접 접근 권한을 즉시 회수한다."
            ),
            context={
                "tags": [
                    "장애 대응",
                    "권한 회수",
                    "임시 권한",
                ],
                "constraints": [
                    "장애 종료 즉시 권한 회수",
                ],
            },
            knowledge_type="DECISION_RULE",
        )

        metrics = _build_metrics(
            candidate=candidate,
            knowledge=knowledge,
        )

        is_duplicate, _ = (
            _is_exception_decision_semantic_noop(
                metrics=metrics,
                semantic_similarity=0.92,
            )
        )

        self.assertFalse(
            _is_exception_decision_strong_lexical_noop(metrics)
        )
        self.assertFalse(
            _is_exception_decision_conditional_allowance_noop(
                candidate=candidate,
                knowledge=knowledge,
                metrics=metrics,
            )
        )
        self.assertFalse(is_duplicate)

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
