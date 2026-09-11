from shared.schemas.common import ContextTags

from shared.schemas.interview import (
    MissionContext,
    KnowledgeCandidate,
    RetrievedKnowledge,
    RetrievedKnowledgeUnit,
    RetrievedEvidence,
    SemanticRelation,
    ConflictAnalysisRequest,
)

from ai.agents.conflict_detector import ConflictDetector


class StubLLMGateway:

    def generate_structured(
        self,
        system_prompt,
        user_prompt,
        response_model,
    ):
        mock_result = {
            "conflicts": [
                {
                    "conflict_type": "CONDITIONAL_CONFLICT",
                    "severity": "HIGH",
                    "description": (
                        "Database per Service 일반 원칙과 "
                        "Migration Phase 1 Shared DB 적용 사례 사이에 "
                        "조건부 차이가 존재한다."
                    ),
                    "sources": [
                        {
                            "source_type": "EVIDENCE",
                            "source_id": (
                                "22222222-2222-4222-8222-222222222222"
                            ),
                            "content": (
                                "Migration Phase 1에서는 "
                                "Shared Physical Database를 사용한다."
                            ),
                        }
                    ],
                    "context_difference": (
                        "Target Principle vs Migration Phase 1"
                    ),
                    "unknown_condition": (
                        "어떤 조건에서 Shared DB를 "
                        "임시 허용할 수 있는지 확인되지 않았다."
                    ),
                    "recommended_question": (
                        "ADR-021에서는 Migration 초기 Shared DB를 "
                        "사용했습니다. 어떤 조건 때문에 Database per "
                        "Service 원칙을 즉시 적용하지 않았습니까?"
                    ),
                }
            ]
        }

        return response_model.model_validate(
            mock_result
        )


class SourceStubLLMGateway:

    def __init__(
        self,
        source_id: str,
    ):
        self.source_id = source_id

    def generate_structured(
        self,
        system_prompt,
        user_prompt,
        response_model,
    ):
        mock_result = {
            "conflicts": [
                {
                    "conflict_type": "DIRECT_CONFLICT",
                    "severity": "HIGH",
                    "description": (
                        "새 Candidate와 기존 지식 사이에 "
                        "직접 충돌이 존재한다."
                    ),
                    # 일부러 EVIDENCE로 반환한다.
                    # Source Guard가 실제 입력 ID를 기준으로
                    # source_type을 정규화하는지 함께 검증한다.
                    "sources": [
                        {
                            "source_type": "EVIDENCE",
                            "source_id": self.source_id,
                            "content": (
                                "기존 지식 또는 Evidence"
                            ),
                        }
                    ],
                    "context_difference": None,
                    "unknown_condition": None,
                    "recommended_question": (
                        "기존 원칙과 새로운 원칙 중 "
                        "어떤 조건이 적용됩니까?"
                    ),
                }
            ]
        }

        return response_model.model_validate(
            mock_result
        )


def _make_candidate():

    return KnowledgeCandidate(
        statement=(
            "복수 서비스가 동일 업무 테이블에 "
            "직접 쓰기를 수행할 수 있다."
        ),
        type="PRINCIPLE",
        context=ContextTags(
            domain="Data Ownership"
        ),
        decision_rule=None,
        rationale=None,
        exception=None,
        novelty_score=0.8,
        confidence_score=0.9,
        validation_status="CANDIDATE",
    )


def _make_mission():

    return MissionContext(
        mission_id="mission-source-test",
        domain="Data Ownership",
        objective=(
            "데이터 소유 및 쓰기 권한 원칙 발굴"
        ),
        focus_topics=[
            "Data Ownership",
            "Write Ownership",
        ],
    )


def test_conflict_detector():

    candidate = KnowledgeCandidate(
        statement="서비스별 데이터베이스 분리를 원칙으로 한다.",
        type="PRINCIPLE",
        context=ContextTags(
            domain="Data Ownership"
        ),
        decision_rule=None,
        rationale=None,
        exception=None,
        novelty_score=0.5,
        confidence_score=0.9,
        validation_status="CANDIDATE",
    )

    mission = MissionContext(
        mission_id="mission-001",
        domain="MSA",
        objective="Legacy Monolith에서 MSA 전환 판단 지식 발굴",
        focus_topics=[
            "Data Ownership",
            "Migration",
        ],
    )

    evidence = RetrievedEvidence(
        chunk_id="22222222-2222-4222-8222-222222222222",
        content=(
            "Migration Phase 1에서는 Order와 Inventory가 "
            "Shared Physical Database를 사용하고 "
            "Logical Separation을 적용한다."
        ),
        similarity=0.95,
        document_id="33333333-3333-4333-8333-333333333333",
        file_name="ADR-021.md",
        page=3,
        section="Database Migration Strategy",
        context=ContextTags(
            project="Project Alpha",
            phase="Migration Phase 1",
            domain="Data Ownership",
        ),
    )

    relation = SemanticRelation(
        target_type="EVIDENCE",
        target_id="22222222-2222-4222-8222-222222222222",
        relation="CONTEXT_DIFFERS",
        reason=(
            "일반 원칙과 Migration Phase 1이라는 "
            "적용 Context에 차이가 있다."
        ),
        context_difference=(
            "General Principle vs Migration Phase 1"
        ),
    )

    request = ConflictAnalysisRequest(
        candidate=candidate,
        mission=mission,
        semantic_relations=[relation],
        retrieved_knowledge=[],
        retrieved_knowledge_units=[],
        retrieved_evidence=[evidence],
    )

    detector = ConflictDetector(
        llm_gateway=StubLLMGateway()
    )

    result = detector.detect(request)

    assert len(result.conflicts) == 1

    conflict = result.conflicts[0]

    assert (
        conflict.conflict_type.value
        == "CONDITIONAL_CONFLICT"
    )

    assert conflict.severity.value == "HIGH"

    assert conflict.unknown_condition is not None

    assert conflict.recommended_question is not None

    # Evidence의 실제 chunk_id가 그대로 유지되는지 검증
    source = conflict.sources[0]

    assert (
        str(source.source_id)
        == "22222222-2222-4222-8222-222222222222"
    )

    source_type = getattr(
        source.source_type,
        "value",
        source.source_type,
    )

    assert source_type == "Evidence"


def test_conflict_source_preserves_baseline_claim_id():

    claim_id = (
        "11111111-1111-4111-8111-111111111111"
    )

    baseline = RetrievedKnowledge(
        claim_id=claim_id,
        claim_type="PRINCIPLE",
        statement=(
            "단일 소유 서비스만 "
            "업무 테이블의 쓰기 권한을 보유한다."
        ),
        similarity=0.97,
        source_chunk_id=(
            "12121212-1212-4121-8121-121212121212"
        ),
        document_id=(
            "13131313-1313-4131-8131-131313131313"
        ),
        file_name="baseline.md",
        page=1,
        section="Data Ownership",
        context=ContextTags(
            domain="Data Ownership",
            scope="Write Ownership",
        ),
    )

    relation = SemanticRelation(
        target_type="KNOWLEDGE",
        target_id=claim_id,
        relation="CONTRADICTS",
        reason=(
            "쓰기 권한 원칙이 직접 반대된다."
        ),
        context_difference=None,
    )

    request = ConflictAnalysisRequest(
        candidate=_make_candidate(),
        mission=_make_mission(),
        semantic_relations=[relation],
        retrieved_knowledge=[baseline],
        retrieved_knowledge_units=[],
        retrieved_evidence=[],
    )

    detector = ConflictDetector(
        llm_gateway=SourceStubLLMGateway(
            source_id=claim_id
        )
    )

    result = detector.detect(request)

    assert len(result.conflicts) == 1

    source = result.conflicts[0].sources[0]

    # Baseline Claim의 claim_id 그대로 유지
    assert str(source.source_id) == claim_id

    source_type = getattr(
        source.source_type,
        "value",
        source.source_type,
    )

    # Baseline Claim은 Conflict Source에서 Knowledge
    assert source_type == "Knowledge"


def test_conflict_source_preserves_verified_knowledge_unit_id():

    knowledge_id = (
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    )

    knowledge_unit = RetrievedKnowledgeUnit(
        knowledge_id=knowledge_id,
        knowledge_type="PRINCIPLE",
        statement=(
            "단일 소유 서비스만 "
            "업무 테이블의 쓰기 권한을 보유한다."
        ),
        context=ContextTags(
            domain="Data Ownership",
            scope="Write Ownership",
        ),
        validation_status="VERIFIED",
        version=3,
        confidence_score=0.95,
        similarity=0.98,
        decision_rule=None,
        rationale=None,
        exception=None,
    )

    relation = SemanticRelation(
        target_type="KNOWLEDGE",
        target_id=knowledge_id,
        relation="CONTRADICTS",
        reason=(
            "기존 VERIFIED Knowledge Unit과 "
            "새 Candidate의 쓰기 권한 원칙이 직접 반대된다."
        ),
        context_difference=None,
    )

    request = ConflictAnalysisRequest(
        candidate=_make_candidate(),
        mission=_make_mission(),
        semantic_relations=[relation],
        retrieved_knowledge=[],
        retrieved_knowledge_units=[
            knowledge_unit
        ],
        retrieved_evidence=[],
    )

    detector = ConflictDetector(
        llm_gateway=SourceStubLLMGateway(
            source_id=knowledge_id
        )
    )

    result = detector.detect(request)

    assert len(result.conflicts) == 1

    source = result.conflicts[0].sources[0]

    # VERIFIED KnowledgeUnit의 knowledge_id 그대로 유지
    assert str(source.source_id) == knowledge_id

    source_type = getattr(
        source.source_type,
        "value",
        source.source_type,
    )

    assert source_type == "Knowledge"


def test_conflict_source_rejects_unknown_llm_generated_id():

    evidence = RetrievedEvidence(
        chunk_id=(
            "22222222-2222-4222-8222-222222222222"
        ),
        content=(
            "Migration Phase 1에서는 "
            "Shared Physical Database를 사용한다."
        ),
        similarity=0.95,
        document_id=(
            "33333333-3333-4333-8333-333333333333"
        ),
        file_name="ADR-021.md",
        page=3,
        section="Database Migration Strategy",
        context=ContextTags(
            domain="Data Ownership"
        ),
    )

    request = ConflictAnalysisRequest(
        candidate=_make_candidate(),
        mission=_make_mission(),
        semantic_relations=[],
        retrieved_knowledge=[],
        retrieved_knowledge_units=[],
        retrieved_evidence=[evidence],
    )

    detector = ConflictDetector(
        llm_gateway=SourceStubLLMGateway(
            source_id="candidate"
        )
    )

    result = detector.detect(request)

    # "candidate"는 실제 Retrieval Source ID가 아니므로
    # Source Guard가 해당 Conflict를 제거해야 한다.
    assert len(result.conflicts) == 0