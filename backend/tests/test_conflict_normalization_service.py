from app.schemas.interview_orchestration import (
    ConflictSourceItem,
    InterviewOrchestrationResponse,
    KnowledgeConflictItem,
)
from app.services.conflict_normalization_service import (
    BASELINE_CLAIM_SOURCE_TYPE,
    EVIDENCE_SOURCE_TYPE,
    KNOWLEDGE_UNIT_SOURCE_TYPE,
    build_conflict_canonicalization_record,
    normalize_interview_conflict_sources,
    resolve_conflict_source_type,
    select_visible_conflict_ids,
)


def test_baseline_claim_source_is_resolved_from_context():
    request_context = {
        "retrieved_knowledge": [
            {
                "claim_id": "claim-1",
            }
        ],
        "retrieved_knowledge_units": [],
        "retrieved_evidence": [],
    }

    result = resolve_conflict_source_type(
        source_type="Knowledge",
        source_id="claim-1",
        request_context=request_context,
    )

    assert (
        result
        == BASELINE_CLAIM_SOURCE_TYPE
    )


def test_knowledge_unit_source_is_resolved_from_context():
    request_context = {
        "retrieved_knowledge": [],
        "retrieved_knowledge_units": [
            {
                "knowledge_id": "knowledge-1",
            }
        ],
        "retrieved_evidence": [],
    }

    result = resolve_conflict_source_type(
        source_type="Knowledge",
        source_id="knowledge-1",
        request_context=request_context,
    )

    assert (
        result
        == KNOWLEDGE_UNIT_SOURCE_TYPE
    )


def test_evidence_source_is_resolved_from_context():
    request_context = {
        "retrieved_knowledge": [],
        "retrieved_knowledge_units": [],
        "retrieved_evidence": [
            {
                "chunk_id": "chunk-1",
            }
        ],
    }

    result = resolve_conflict_source_type(
        source_type="Evidence",
        source_id="chunk-1",
        request_context=request_context,
    )

    assert (
        result
        == EVIDENCE_SOURCE_TYPE
    )


def test_turn_response_conflict_sources_are_normalized():
    request_context = {
        "retrieved_knowledge": [
            {
                "claim_id": "claim-1",
            }
        ],
        "retrieved_knowledge_units": [],
        "retrieved_evidence": [
            {
                "chunk_id": "chunk-1",
            }
        ],
    }

    ai_result = (
        InterviewOrchestrationResponse(
            conflicts=[
                KnowledgeConflictItem(
                    conflict_type=(
                        "CONDITIONAL_CONFLICT"
                    ),
                    severity="HIGH",
                    description="테스트 충돌",
                    sources=[
                        ConflictSourceItem(
                            source_type=(
                                "Knowledge"
                            ),
                            source_id=(
                                "claim-1"
                            ),
                            content=(
                                "Baseline Claim"
                            ),
                        ),
                        ConflictSourceItem(
                            source_type=(
                                "Evidence"
                            ),
                            source_id=(
                                "chunk-1"
                            ),
                            content=(
                                "Document Chunk"
                            ),
                        ),
                    ],
                )
            ]
        )
    )

    normalized = (
        normalize_interview_conflict_sources(
            result=ai_result,
            request_context=request_context,
        )
    )

    assert (
        normalized
        .conflicts[0]
        .sources[0]
        .source_type
        == BASELINE_CLAIM_SOURCE_TYPE
    )

    assert (
        normalized
        .conflicts[0]
        .sources[1]
        .source_type
        == EVIDENCE_SOURCE_TYPE
    )

    # 원본은 mutate하지 않는다.
    assert (
        ai_result
        .conflicts[0]
        .sources[0]
        .source_type
        == "Knowledge"
    )


def test_atomic_conflicts_are_kept_separately():
    evidence = (
        EVIDENCE_SOURCE_TYPE,
        "chunk-1",
        "회의록 기준",
    )

    common = (
        BASELINE_CLAIM_SOURCE_TYPE,
        "claim-common",
        "담당자와 기한 모두 필수",
    )

    assignee = (
        BASELINE_CLAIM_SOURCE_TYPE,
        "claim-assignee",
        "담당자 필수",
    )

    due_date = (
        BASELINE_CLAIM_SOURCE_TYPE,
        "claim-due",
        "완료 기한 필수",
    )

    assignee_conflict = (
        build_conflict_canonicalization_record(
            conflict_id="conflict-assignee",
            interview_id="interview-1",
            conflict_type=(
                "CONDITIONAL_CONFLICT"
            ),
            description=(
                "담당자를 기록하지 않는다."
            ),
            sources=[
                common,
                assignee,
                evidence,
            ],
        )
    )

    due_conflict = (
        build_conflict_canonicalization_record(
            conflict_id="conflict-due",
            interview_id="interview-1",
            conflict_type=(
                "CONDITIONAL_CONFLICT"
            ),
            description=(
                "완료 기한을 기록하지 않는다."
            ),
            sources=[
                common,
                due_date,
                evidence,
            ],
        )
    )

    visible = (
        select_visible_conflict_ids(
            [
                assignee_conflict,
                due_conflict,
            ]
        )
    )

    assert visible == {
        "conflict-assignee",
        "conflict-due",
    }


def test_composite_conflict_is_suppressed():
    evidence = (
        EVIDENCE_SOURCE_TYPE,
        "chunk-1",
        "회의록 기준",
    )

    common = (
        BASELINE_CLAIM_SOURCE_TYPE,
        "claim-common",
        "담당자와 기한 모두 필수",
    )

    assignee = (
        BASELINE_CLAIM_SOURCE_TYPE,
        "claim-assignee",
        "담당자 필수",
    )

    due_date = (
        BASELINE_CLAIM_SOURCE_TYPE,
        "claim-due",
        "완료 기한 필수",
    )

    # Mission API는 최신순으로 전달한다.
    composite_conflict = (
        build_conflict_canonicalization_record(
            conflict_id="conflict-composite",
            interview_id="interview-1",
            conflict_type=(
                "CONDITIONAL_CONFLICT"
            ),
            description=(
                "담당자와 완료 기한을 "
                "모두 기록하지 않는다."
            ),
            sources=[
                common,
                assignee,
                due_date,
                evidence,
            ],
        )
    )

    assignee_conflict = (
        build_conflict_canonicalization_record(
            conflict_id="conflict-assignee",
            interview_id="interview-1",
            conflict_type=(
                "CONDITIONAL_CONFLICT"
            ),
            description=(
                "담당자를 기록하지 않는다."
            ),
            sources=[
                common,
                assignee,
                evidence,
            ],
        )
    )

    due_conflict = (
        build_conflict_canonicalization_record(
            conflict_id="conflict-due",
            interview_id="interview-1",
            conflict_type=(
                "CONDITIONAL_CONFLICT"
            ),
            description=(
                "완료 기한을 기록하지 않는다."
            ),
            sources=[
                common,
                due_date,
                evidence,
            ],
        )
    )

    visible = (
        select_visible_conflict_ids(
            [
                composite_conflict,
                assignee_conflict,
                due_conflict,
            ]
        )
    )

    assert visible == {
        "conflict-assignee",
        "conflict-due",
    }


def test_same_sources_and_similar_description_keep_newest():
    sources = [
        (
            BASELINE_CLAIM_SOURCE_TYPE,
            "claim-1",
            "담당자를 반드시 기록한다.",
        ),
        (
            EVIDENCE_SOURCE_TYPE,
            "chunk-1",
            "회의록 기준",
        ),
    ]

    newest = (
        build_conflict_canonicalization_record(
            conflict_id="newest",
            interview_id="interview-1",
            conflict_type=(
                "CONDITIONAL_CONFLICT"
            ),
            description=(
                "일반적인 내부 회의에서는 "
                "담당자를 회의록에 기록하지 않는다."
            ),
            sources=sources,
        )
    )

    older = (
        build_conflict_canonicalization_record(
            conflict_id="older",
            interview_id="interview-1",
            conflict_type=(
                "CONDITIONAL_CONFLICT"
            ),
            description=(
                "일반적인 내부 회의에서는 "
                "담당자를 회의록에 기록하지 않는다."
            ),
            sources=sources,
        )
    )

    visible = (
        select_visible_conflict_ids(
            [
                newest,
                older,
            ]
        )
    )

    assert visible == {
        "newest",
    }


def test_different_interviews_are_not_deduplicated():
    sources = [
        (
            BASELINE_CLAIM_SOURCE_TYPE,
            "claim-1",
            "담당자를 반드시 기록한다.",
        ),
        (
            EVIDENCE_SOURCE_TYPE,
            "chunk-1",
            "회의록 기준",
        ),
    ]

    first = (
        build_conflict_canonicalization_record(
            conflict_id="conflict-1",
            interview_id="interview-1",
            conflict_type=(
                "CONDITIONAL_CONFLICT"
            ),
            description=(
                "담당자를 기록하지 않는다."
            ),
            sources=sources,
        )
    )

    second = (
        build_conflict_canonicalization_record(
            conflict_id="conflict-2",
            interview_id="interview-2",
            conflict_type=(
                "CONDITIONAL_CONFLICT"
            ),
            description=(
                "담당자를 기록하지 않는다."
            ),
            sources=sources,
        )
    )

    visible = (
        select_visible_conflict_ids(
            [
                first,
                second,
            ]
        )
    )

    assert visible == {
        "conflict-1",
        "conflict-2",
    }