import inspect
import unittest
import uuid
from types import SimpleNamespace

import app.services.auto_knowledge_sync_service as auto_service
import app.services.knowledge_synthesis_apply_service as apply_service
import app.services.knowledge_graph_policy_service as graph_policy_service
from app.schemas.knowledge_synthesis import (
    KnowledgeSynthesisAIResponse,
    ProposedSynthesisRelation,
    SynthesisContext,
    SynthesizedKnowledgeUnit,
)
from app.services.knowledge_synthesis_service import (
    _normalize_add_exception_payload,
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
    context: dict | None = None,
):
    return SimpleNamespace(
        knowledge_id=uuid.uuid4(),
        knowledge_type=knowledge_type,
        statement=statement,
        context=context or {},
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

    def test_same_type_enrich_with_different_atomic_scope_becomes_merge(self):
        """
        Same type is not enough for a version chain.  The actual Review Queue
        case tries to ENRICH a read-exception with an independent write-ban.
        Synthesis normalization must preserve the Candidate atom as an
        independent MERGE before the snapshot reaches Human Review.
        """
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
            "constraints": [
                "INSERT 금지",
                "UPDATE 금지",
                "DELETE 금지",
            ],
            "tags": ["쓰기 금지", "데이터 무결성"],
        }
        candidate.exception = (
            "긴급 상황에서도 데이터 변경 작업은 허용하지 않는다."
        )

        target = _knowledge(
            "EXCEPTION",
            (
                "장애 대응 중 API나 이벤트를 통한 확인이 불가능한 "
                "긴급 상황에서는 타 서비스 데이터베이스의 읽기 "
                "직접 조회를 예외적으로 허용한다."
            ),
            context={
                "domain": "MSA Architecture",
                "phase": "운영 및 장애 대응",
                "system": "타 서비스 데이터베이스 접근",
                "scope": "읽기 조회",
                "time": "장애 대응 중",
                "constraints": [],
                "tags": ["장애 대응", "예외 접근"],
            },
        )

        ai_result = KnowledgeSynthesisAIResponse(
            operation="ENRICH",
            target_knowledge_ids=[target.knowledge_id],
            synthesized_knowledge_units=[
                SynthesizedKnowledgeUnit(
                    statement=(
                        "장애 중 직접 읽기 조회는 허용할 수 있지만 "
                        "INSERT, UPDATE, DELETE 같은 직접 변경 작업은 "
                        "수행하지 않는다."
                    ),
                    type="EXCEPTION",
                    context=SynthesisContext(
                        domain="MSA Architecture",
                        phase="운영 및 장애 대응",
                        system="타 서비스 데이터베이스 접근",
                        scope="읽기 조회 및 데이터 변경 작업",
                        time="장애 대응 중",
                    ),
                    decision_rule=None,
                    rationale="AI enrich",
                    exception=(
                        "직접 데이터 변경 작업은 허용되지 않는다."
                    ),
                    novelty_score=0.91,
                    confidence_score=0.99,
                    validation_status="CANDIDATE",
                )
            ],
            relations=[
                ProposedSynthesisRelation(
                    synthesized_index=0,
                    target_knowledge_id=target.knowledge_id,
                    relation="REFINES",
                    reason="AI enrich",
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
        self.assertEqual(normalized.relations, [])
        self.assertEqual(
            normalized.synthesized_knowledge_units[0].statement,
            candidate.statement,
        )
        self.assertEqual(
            normalized.synthesized_knowledge_units[0].type,
            "EXCEPTION",
        )
        self.assertIsNotNone(reason)

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

    def test_apply_uses_single_central_graph_policy(self):
        source = inspect.getsource(
            apply_service.validate_and_apply_synthesis
        )

        self.assertIn(
            "build_knowledge_graph_policy_plan(",
            source,
        )
        self.assertNotIn(
            "find_duplicate_active_knowledge(",
            source,
        )
        self.assertNotIn(
            "assess_synthesized_unit_material_change(",
            source,
        )
        self.assertIn(
            "GraphApplyAction.CREATE_VERSION",
            source,
        )
        self.assertIn(
            "GraphApplyAction.CREATE_NEW",
            source,
        )

    def test_central_policy_merge_cannot_supersede_targets(self):
        source = inspect.getsource(
            graph_policy_service._validate_structure
        )
        relation_source = inspect.getsource(
            graph_policy_service._validate_relation_shape
        )

        self.assertIn(
            'operation == "MERGE"',
            source,
        )
        self.assertIn(
            "if targets:",
            source,
        )
        self.assertIn(
            'relation.relation_type == "SUPERSEDES"',
            relation_source,
        )

    def test_central_policy_duplicate_gate_precedes_operation_actions(self):
        source = inspect.getsource(
            graph_policy_service.build_knowledge_graph_policy_plan
        )

        duplicate_index = source.index(
            "duplicate_match = find_duplicate_active_knowledge("
        )
        version_index = source.index(
            "if synthesis.operation in VERSION_OPERATIONS:"
        )
        create_new_index = source.rindex(
            "action=GraphApplyAction.CREATE_NEW"
        )

        self.assertLess(duplicate_index, version_index)
        self.assertLess(duplicate_index, create_new_index)
        self.assertIn(
            "The AI operation cannot bypass it.",
            source,
        )

    def test_central_policy_version_material_guard_is_shared(self):
        source = inspect.getsource(
            graph_policy_service.build_knowledge_graph_policy_plan
        )

        self.assertIn(
            "assess_synthesized_unit_material_change(",
            source,
        )
        self.assertIn(
            "GraphApplyAction.REUSE_TARGET",
            source,
        )
        self.assertIn(
            "GraphApplyAction.CREATE_VERSION",
            source,
        )

    def test_central_policy_add_exception_reuses_child_and_keeps_relation(self):
        source = inspect.getsource(
            graph_policy_service.build_knowledge_graph_policy_plan
        )

        add_start = source.index(
            'if synthesis.operation == "ADD_EXCEPTION":'
        )
        generic_duplicate_start = source.index(
            "# Every other operation first passes",
            add_start,
        )
        add_block = source[
            add_start:generic_duplicate_start
        ]

        self.assertIn(
            "_proposal_as_candidate(proposal)",
            add_block,
        )
        self.assertIn(
            'knowledge_type != "EXCEPTION"',
            add_block,
        )
        self.assertEqual(
            add_block.count(
                "relations_to_apply=_build_relation_policy_plans("
            ),
            2,
        )
        self.assertNotIn(
            "relations_to_apply=()",
            add_block,
        )

    def test_add_exception_with_parent_proposal_becomes_atomic_exception(self):
        candidate = _candidate(
            "PRINCIPLE",
            "평상시에는 타 서비스 데이터베이스를 직접 조회하지 않는다.",
        )
        candidate.exception = (
            "장애 대응 중 API나 이벤트로 확인하기 어렵거나 정상 경로로 "
            "인해 복구가 지연되는 긴급 상황에서는 일시적인 직접 읽기 "
            "조회를 예외적으로 허용한다."
        )
        candidate.context = {
            "domain": "MSA Architecture",
            "phase": "평상시 운영",
            "system": "타 서비스 데이터베이스 접근",
            "scope": "서비스 간 데이터 조회",
            "time": "평상시",
            "constraints": [],
            "tags": ["운영 원칙", "타 서비스 DB"],
        }

        target = _knowledge(
            "PRINCIPLE",
            "평상시 서비스 간 데이터 접근은 API 또는 이벤트를 사용한다.",
        )

        ai_result = KnowledgeSynthesisAIResponse(
            operation="ADD_EXCEPTION",
            target_knowledge_ids=[target.knowledge_id],
            synthesized_knowledge_units=[
                SynthesizedKnowledgeUnit(
                    statement=candidate.statement,
                    type="PRINCIPLE",
                    context=SynthesisContext(
                        domain="MSA Architecture",
                        phase="평상시 운영",
                    ),
                    decision_rule=None,
                    rationale=None,
                    exception=candidate.exception,
                    novelty_score=0.72,
                    confidence_score=0.99,
                    validation_status="CANDIDATE",
                )
            ],
            relations=[
                ProposedSynthesisRelation(
                    synthesized_index=0,
                    target_knowledge_id=target.knowledge_id,
                    relation="HAS_EXCEPTION",
                    reason="AI add exception",
                )
            ],
            reason="AI add exception",
        )

        normalized, reason = _normalize_add_exception_payload(
            candidate=candidate,
            related_knowledge=[target],
            ai_result=ai_result,
        )

        self.assertEqual(normalized.operation, "ADD_EXCEPTION")
        self.assertEqual(
            normalized.target_knowledge_ids,
            [target.knowledge_id],
        )
        self.assertEqual(
            normalized.synthesized_knowledge_units[0].type,
            "EXCEPTION",
        )
        self.assertEqual(
            normalized.synthesized_knowledge_units[0].statement,
            candidate.exception,
        )
        self.assertIsNone(
            normalized.synthesized_knowledge_units[0].exception
        )
        self.assertEqual(
            normalized.relations[0].relation,
            "HAS_EXCEPTION",
        )
        self.assertIsNotNone(reason)

    def test_add_exception_without_explicit_exception_becomes_independent_merge(self):
        """
        실제 Review Queue 회귀 테스트.

        Candidate는 "직접 조회 시 read-only + 최소 범위"라는 독립
        PRINCIPLE이고 exception 필드는 비어 있는데, AI가 기존 평상시
        API/Event 원칙의 ADD_EXCEPTION으로 과도하게 해석한 경우다.

        명시적인 exception payload가 없는 비-EXCEPTION Candidate는
        AI가 생성한 예외 문구를 채택하지 않고 Candidate 자체를 독립
        MERGE Knowledge로 보존해야 한다.
        """
        candidate = _candidate(
            "PRINCIPLE",
            (
                "타 서비스 데이터베이스 직접 조회는 읽기 전용 계정으로 "
                "필요한 테이블과 데이터 범위에 한정해야 한다."
            ),
        )
        candidate.exception = None
        candidate.context = {
            "domain": "MSA Architecture",
            "phase": "운영 및 장애 대응",
            "system": "타 서비스 데이터베이스 접근",
            "scope": "읽기 조회",
            "time": "장애 대응 중",
            "constraints": [
                "읽기 전용 계정 사용",
                "필요한 테이블로 범위 제한",
                "필요한 데이터로 범위 제한",
            ],
            "tags": [
                "최소 권한",
                "읽기 전용",
                "데이터 범위 제한",
            ],
        }

        target = _knowledge(
            "PRINCIPLE",
            (
                "평상시 서비스 간 데이터 접근은 데이터베이스 직접 "
                "조회보다 API 또는 이벤트를 사용한다."
            ),
        )

        ai_result = KnowledgeSynthesisAIResponse(
            operation="ADD_EXCEPTION",
            target_knowledge_ids=[target.knowledge_id],
            synthesized_knowledge_units=[
                SynthesizedKnowledgeUnit(
                    statement=(
                        "평상시에는 API 또는 이벤트를 사용한다. 단, "
                        "장애 대응 중 직접 조회가 필요한 경우 읽기 전용 "
                        "계정과 필요한 범위로 제한한다."
                    ),
                    type="PRINCIPLE",
                    context=SynthesisContext(
                        domain="MSA Architecture",
                        phase="운영 및 장애 대응",
                    ),
                    decision_rule=None,
                    rationale="AI add exception",
                    exception=(
                        "장애 대응 중 직접 조회가 필요한 경우 읽기 전용 "
                        "계정을 사용하고 필요한 범위로 제한한다."
                    ),
                    novelty_score=0.84,
                    confidence_score=0.99,
                    validation_status="CANDIDATE",
                )
            ],
            relations=[
                ProposedSynthesisRelation(
                    synthesized_index=0,
                    target_knowledge_id=target.knowledge_id,
                    relation="HAS_EXCEPTION",
                    reason="AI add exception",
                )
            ],
            reason="AI add exception",
        )

        normalized, reason = _normalize_add_exception_payload(
            candidate=candidate,
            related_knowledge=[target],
            ai_result=ai_result,
        )

        self.assertEqual(normalized.operation, "MERGE")
        self.assertEqual(normalized.target_knowledge_ids, [])
        self.assertEqual(normalized.relations, [])
        self.assertEqual(
            normalized.synthesized_knowledge_units[0].type,
            "PRINCIPLE",
        )
        self.assertEqual(
            normalized.synthesized_knowledge_units[0].statement,
            candidate.statement,
        )
        self.assertIsNone(
            normalized.synthesized_knowledge_units[0].exception
        )
        self.assertIsNotNone(reason)

    def test_apply_tracks_actual_graph_change_instead_of_result_ids(self):
        source = inspect.getsource(
            apply_service.validate_and_apply_synthesis
        )

        self.assertIn(
            "graph_changed = False",
            source,
        )
        self.assertIn(
            "if relation_added:",
            source,
        )
        self.assertIn(
            "and graph_changed",
            source,
        )
        self.assertNotIn(
            "and resulting_ids",
            source,
        )



if __name__ == "__main__":
    unittest.main()
