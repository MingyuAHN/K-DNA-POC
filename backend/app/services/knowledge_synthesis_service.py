import re
import uuid

from fastapi import (
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.clients.ai_client import (
    AIClientError,
    ai_client,
)
from app.models.interview_analysis import (
    InterviewAnalysis,
    KnowledgeCandidate,
)
from app.models.knowledge_core import (
    KnowledgeUnit,
)
from app.models.knowledge_synthesis import (
    KnowledgeSynthesis,
    KnowledgeSynthesisRelation,
    KnowledgeSynthesisUnit,
)
from app.schemas.knowledge_synthesis import (
    ExistingKnowledge,
    KnowledgeSynthesisAIRequest,
    KnowledgeSynthesisAIResponse,
    KnowledgeSynthesisRequest,
    KnowledgeSynthesisResponse,
    ProposedSynthesisRelation,
    StoredSynthesizedKnowledgeUnit,
    StoredSynthesisRelation,
    SynthesisCandidate,
    SynthesisContext,
    SynthesisDecisionRule,
    SynthesizedKnowledgeUnit,
)


ACTIVE_KNOWLEDGE_STATUSES = {
    "VERIFIED",
    "EXPERT_OPINION",
}

EXCEPTION_PARENT_TYPES = {
    "PRINCIPLE",
    "DECISION_RULE",
}

EXCEPTION_PRESERVATION_SKIP_OPERATIONS = {
    "KEEP_CONFLICT",
    "SPLIT_BY_CONTEXT",
}

SAFE_FALLBACK_RELATED_LIMIT = 1
SAFE_FALLBACK_MIN_STATEMENT_JACCARD = 0.10


def _float_or_none(
    value,
) -> float | None:
    if value is None:
        return None

    return float(value)


def _candidate_to_ai(
    candidate: KnowledgeCandidate,
) -> SynthesisCandidate:

    context = (
        candidate.context or {}
    )

    decision_rule = None

    if candidate.decision_rule:
        decision_rule = (
            SynthesisDecisionRule
            .model_validate(
                candidate.decision_rule
            )
        )

    return SynthesisCandidate(
        statement=candidate.statement,
        type=candidate.knowledge_type,
        context=(
            SynthesisContext
            .model_validate(context)
        ),
        decision_rule=decision_rule,
        rationale=candidate.rationale,
        exception=candidate.exception,
        novelty_score=(
            float(candidate.novelty_score)
            if candidate.novelty_score
            is not None
            else 0.0
        ),
        confidence_score=(
            float(candidate.confidence_score)
            if candidate.confidence_score
            is not None
            else 0.0
        ),
        validation_status=(
            candidate.validation_status
        ),
    )


def _knowledge_to_ai(
    knowledge: KnowledgeUnit,
) -> ExistingKnowledge:

    return ExistingKnowledge(
        knowledge_id=knowledge.knowledge_id,
        statement=knowledge.statement,
        type=knowledge.knowledge_type,
        context=knowledge.context or {},
        decision_rule=knowledge.decision_rule,
        rationale=knowledge.rationale,
        exception=knowledge.exception,
        confidence_score=(
            _float_or_none(
                knowledge.confidence_score
            )
        ),
        validation_status=knowledge.status,
    )


def _candidate_to_synthesized_unit(
    candidate: KnowledgeCandidate,
    knowledge_type: str | None = None,
) -> SynthesizedKnowledgeUnit:
    """
    Candidate의 atomic 의미를 그대로 보존한 synthesized unit을 만든다.

    AI가 서로 다른 Knowledge Type의 기존 지식과 Candidate를 하나의
    mega-knowledge로 흡수하려 할 때 Backend가 Candidate 자체를 독립
    Knowledge Unit으로 보존하기 위해 사용한다.
    """

    decision_rule = None

    if candidate.decision_rule:
        decision_rule = (
            SynthesisDecisionRule
            .model_validate(
                candidate.decision_rule
            )
        )

    return SynthesizedKnowledgeUnit(
        statement=candidate.statement,
        type=(
            knowledge_type
            or candidate.knowledge_type
        ),
        context=(
            SynthesisContext.model_validate(
                candidate.context or {}
            )
        ),
        decision_rule=decision_rule,
        rationale=candidate.rationale,
        exception=candidate.exception,
        novelty_score=(
            float(candidate.novelty_score)
            if candidate.novelty_score
            is not None
            else 0.0
        ),
        confidence_score=(
            float(candidate.confidence_score)
            if candidate.confidence_score
            is not None
            else 0.0
        ),
        validation_status=(
            candidate.validation_status
        ),
    )


def _candidate_to_exception_unit(
    candidate: KnowledgeCandidate,
) -> SynthesizedKnowledgeUnit:
    """
    EXCEPTION Candidate를 기존 PRINCIPLE/DECISION_RULE 안에 흡수하지
    않고 독립 Knowledge Unit으로 보존한다.
    """

    return _candidate_to_synthesized_unit(
        candidate=candidate,
        knowledge_type="EXCEPTION",
    )


def _normalize_exception_synthesis(
    candidate: KnowledgeCandidate,
    related_knowledge: list[KnowledgeUnit],
    ai_result: KnowledgeSynthesisAIResponse,
) -> tuple[
    KnowledgeSynthesisAIResponse,
    str | None,
]:
    """
    Backend EXCEPTION preservation policy.

    EXCEPTION Candidate가 정확히 하나의 PRINCIPLE/DECISION_RULE과
    연결되는 경우에는 AI가 ENRICH/SUPERSEDE/MERGE를 제안하더라도
    기존 Rule의 새 Version 안으로 예외를 흡수하지 않는다.

    대신:
      - operation = ADD_EXCEPTION
      - synthesized unit = 독립 EXCEPTION
      - relation = parent --HAS_EXCEPTION--> exception

    단, KEEP_CONFLICT / SPLIT_BY_CONTEXT는 실제 충돌/맥락 분리 의미를
    보존해야 하므로 강제 정규화하지 않는다.

    Target이 모호한 경우에도 Backend가 임의로 부모 Knowledge를
    선택하지 않고 AI 결과를 그대로 둔다.
    """

    if candidate.knowledge_type != "EXCEPTION":
        return (
            ai_result,
            None,
        )

    if (
        ai_result.operation
        in EXCEPTION_PRESERVATION_SKIP_OPERATIONS
    ):
        return (
            ai_result,
            None,
        )

    related_by_id = {
        row.knowledge_id: row
        for row in related_knowledge
    }

    target = None

    # AI가 정확히 하나의 target을 명시한 경우 우선 사용한다.
    if len(ai_result.target_knowledge_ids) == 1:
        candidate_target = related_by_id.get(
            ai_result.target_knowledge_ids[0]
        )

        if (
            candidate_target is not None
            and candidate_target.knowledge_type
            in EXCEPTION_PARENT_TYPES
        ):
            target = candidate_target

    # AI가 target을 비워 두었더라도 Backend가 전달한 관련 Knowledge 중
    # 호환 가능한 부모가 정확히 하나라면 그 Knowledge를 사용한다.
    elif not ai_result.target_knowledge_ids:
        compatible_targets = [
            row
            for row in related_knowledge
            if row.knowledge_type
            in EXCEPTION_PARENT_TYPES
        ]

        if len(compatible_targets) == 1:
            target = compatible_targets[0]

    if target is None:
        return (
            ai_result,
            None,
        )

    original_operation = ai_result.operation

    reason = (
        "Backend EXCEPTION preservation policy applied: "
        "the EXCEPTION candidate is kept as an independent "
        "Knowledge Unit and linked to the existing "
        f"{target.knowledge_type} with HAS_EXCEPTION instead "
        "of being absorbed into a new parent version. "
        f"Original AI operation={original_operation}."
    )

    normalized = KnowledgeSynthesisAIResponse(
        operation="ADD_EXCEPTION",
        target_knowledge_ids=[
            target.knowledge_id
        ],
        synthesized_knowledge_units=[
            _candidate_to_exception_unit(
                candidate
            )
        ],
        relations=[
            ProposedSynthesisRelation(
                synthesized_index=0,
                target_knowledge_id=(
                    target.knowledge_id
                ),
                relation="HAS_EXCEPTION",
                reason=(
                    "The candidate is an explicit exception "
                    "to the existing rule/principle and is "
                    "preserved as a separate EXCEPTION "
                    "Knowledge Unit."
                ),
            )
        ],
        reason=reason,
    )

    return (
        normalized,
        reason,
    )


def _attach_review_synthesis_if_waiting(
    candidate: KnowledgeCandidate,
    synthesis: KnowledgeSynthesis,
) -> bool:
    """
    STALE 이후 수동 재-Synthesis된 REVIEW_REQUIRED Candidate를
    새 Synthesis와 다시 연결한다.

    최초 Auto Sync에서는 Candidate가 아직 REVIEW_REQUIRED가 아닐 수
    있으므로 그 경우에는 아무 것도 변경하지 않는다.
    """

    if candidate.review_status != "REVIEW_REQUIRED":
        return False

    candidate.review_synthesis_id = (
        synthesis.synthesis_id
    )
    candidate.review_reason = (
        "Synthesis refreshed against the current knowledge graph; "
        "human review is required before apply"
    )

    return True


def _token_set(value: str | None) -> set[str]:
    if not value:
        return set()

    return {
        token
        for token in re.findall(
            r"[A-Za-z0-9가-힣_]+",
            value.lower(),
        )
        if len(token) >= 2
    }


def _list_token_set(values) -> set[str]:
    result: set[str] = set()

    if not isinstance(values, list):
        return result

    for value in values:
        if isinstance(value, str):
            result.update(_token_set(value))

    return result


def _statement_jaccard(
    left: str | None,
    right: str | None,
) -> float:
    left_tokens = _token_set(left)
    right_tokens = _token_set(right)

    if not left_tokens or not right_tokens:
        return 0.0

    union = left_tokens | right_tokens

    if not union:
        return 0.0

    return len(left_tokens & right_tokens) / len(union)


def _same_context_value(
    candidate: KnowledgeCandidate,
    knowledge: KnowledgeUnit,
    key: str,
) -> bool:
    candidate_value = (candidate.context or {}).get(key)
    knowledge_value = (knowledge.context or {}).get(key)

    if candidate_value is None or knowledge_value is None:
        return False

    candidate_text = str(candidate_value).strip().lower()
    knowledge_text = str(knowledge_value).strip().lower()

    if not candidate_text or not knowledge_text:
        return False

    return candidate_text == knowledge_text


def _fallback_type_compatible(
    candidate: KnowledgeCandidate,
    knowledge: KnowledgeUnit,
) -> bool:
    if candidate.knowledge_type == knowledge.knowledge_type:
        return True

    # EXCEPTION은 기존 Rule/Principle의 예외로 연결될 수 있으므로
    # 안전한 fallback에서도 parent 후보를 허용한다.
    return (
        candidate.knowledge_type == "EXCEPTION"
        and knowledge.knowledge_type
        in EXCEPTION_PARENT_TYPES
    )


def _fallback_relevance_score(
    candidate: KnowledgeCandidate,
    knowledge: KnowledgeUnit,
) -> float | None:
    if not _fallback_type_compatible(
        candidate=candidate,
        knowledge=knowledge,
    ):
        return None

    candidate_context = candidate.context or {}
    knowledge_context = knowledge.context or {}

    candidate_tags = _list_token_set(
        candidate_context.get("tags")
    )
    knowledge_tags = _list_token_set(
        knowledge_context.get("tags")
    )
    tag_overlap = candidate_tags & knowledge_tags

    jaccard = _statement_jaccard(
        candidate.statement,
        knowledge.statement,
    )

    same_system = _same_context_value(
        candidate, knowledge, "system"
    )
    same_scope = _same_context_value(
        candidate, knowledge, "scope"
    )

    has_signal = (
        bool(tag_overlap)
        or jaccard
        >= SAFE_FALLBACK_MIN_STATEMENT_JACCARD
        or (same_system and same_scope)
    )

    if not has_signal:
        return None

    score = 0.0

    if candidate.knowledge_type == knowledge.knowledge_type:
        score += 3.0

    for key, weight in {
        "domain": 1.0,
        "system": 1.5,
        "phase": 1.0,
        "scope": 1.5,
        "project": 1.0,
    }.items():
        if _same_context_value(candidate, knowledge, key):
            score += weight

    score += min(float(len(tag_overlap) * 2), 6.0)
    score += jaccard * 5.0

    return score


def _get_safe_fallback_related_knowledge(
    db: Session,
    mission_id: uuid.UUID,
    candidate: KnowledgeCandidate,
) -> list[KnowledgeUnit]:
    """
    related_knowledge_ids가 비어 있는 수동 재-Synthesis에서도 Mission의
    모든 Knowledge를 AI에 넘기지 않는다.

    활성 Knowledge 중 의미 신호가 있는 후보만 점수화하고 최대 1개만
    전달하여 multi-root MERGE와 mega-knowledge 생성을 방지한다.
    """

    rows = (
        db.query(KnowledgeUnit)
        .filter(
            KnowledgeUnit.mission_id == mission_id,
            KnowledgeUnit.status.in_(
                ACTIVE_KNOWLEDGE_STATUSES
            ),
        )
        .order_by(KnowledgeUnit.updated_at.desc())
        .all()
    )

    scored: list[tuple[float, KnowledgeUnit]] = []

    for knowledge in rows:
        score = _fallback_relevance_score(
            candidate=candidate,
            knowledge=knowledge,
        )

        if score is None:
            continue

        scored.append((score, knowledge))

    scored.sort(
        key=lambda item: item[0],
        reverse=True,
    )

    return [
        knowledge
        for _, knowledge
        in scored[:SAFE_FALLBACK_RELATED_LIMIT]
    ]


def _normalize_atomic_version_policy(
    candidate: KnowledgeCandidate,
    related_knowledge: list[KnowledgeUnit],
    ai_result: KnowledgeSynthesisAIResponse,
) -> tuple[KnowledgeSynthesisAIResponse, str | None]:
    """
    Version chain은 동일한 atomic Knowledge Type 안에서만 허용한다.

    - ENRICH/SUPERSEDE는 Candidate, target, synthesized unit의 type이
      모두 같을 때만 version update로 유지한다.
    - ENRICH/SUPERSEDE인데 target이 0개라면 version update가 성립하지
      않으므로 Candidate를 독립 Knowledge Unit(MERGE)으로 정규화한다.
    - type이 다르면 Candidate 자체를 독립 Knowledge Unit(MERGE)으로
      보존하고 기존 target과의 SUPERSEDES 관계는 REFINES로 낮춘다.
    - MERGE는 기존 Knowledge를 대체하는 operation으로 사용하지 않는다.
      관련 Knowledge가 있는 MERGE라면 Candidate 자체를 독립 unit으로
      보존하고 target_knowledge_ids를 비운다.
    """

    related_by_id = {
        row.knowledge_id: row
        for row in related_knowledge
    }

    if ai_result.operation in {
        "ENRICH",
        "SUPERSEDE",
    }:
        # --------------------------------------------------
        # Target 없는 version operation 방어
        #
        # ENRICH/SUPERSEDE는 기존 Knowledge를 대상으로 하는
        # version update이므로 target이 정확히 존재해야 한다.
        #
        # Manual/review 재-Synthesis에서 related knowledge가 없는데
        # AI가 ENRICH/SUPERSEDE를 반환할 수 있으므로, 이 경우에는
        # Candidate의 atomic 의미를 보존한 독립 Knowledge Unit으로
        # 정규화한다.
        # --------------------------------------------------
        if not ai_result.target_knowledge_ids:
            reason = (
                "Backend atomic version policy applied: "
                f"targetless {ai_result.operation} was converted "
                "to an independent Knowledge Unit because a "
                "version operation requires an existing target."
            )

            return (
                KnowledgeSynthesisAIResponse(
                    operation="MERGE",
                    target_knowledge_ids=[],
                    synthesized_knowledge_units=[
                        _candidate_to_synthesized_unit(
                            candidate
                        )
                    ],
                    relations=[],
                    reason=reason,
                ),
                reason,
            )

        if (
            len(ai_result.target_knowledge_ids) == 1
            and len(
                ai_result.synthesized_knowledge_units
            ) == 1
        ):
            target_id = ai_result.target_knowledge_ids[0]
            target = related_by_id.get(target_id)
            proposal = (
                ai_result.synthesized_knowledge_units[0]
            )

            if target is not None:
                same_type_chain = (
                    candidate.knowledge_type
                    == target.knowledge_type
                    == proposal.type
                )

                if same_type_chain:
                    return ai_result, None

                relations: list[
                    ProposedSynthesisRelation
                ] = []
                has_target_relation = False

                for relation in ai_result.relations:
                    relation_type = relation.relation

                    if relation.target_knowledge_id == target_id:
                        has_target_relation = True

                        if relation_type == "SUPERSEDES":
                            relation_type = "REFINES"

                    relations.append(
                        ProposedSynthesisRelation(
                            synthesized_index=0,
                            target_knowledge_id=(
                                relation.target_knowledge_id
                            ),
                            relation=relation_type,
                            reason=relation.reason,
                        )
                    )

                if not has_target_relation:
                    relations.append(
                        ProposedSynthesisRelation(
                            synthesized_index=0,
                            target_knowledge_id=target_id,
                            relation="REFINES",
                            reason=(
                                "Cross-type synthesis is preserved "
                                "as independent atomic knowledge; "
                                "the semantic link is REFINES, not "
                                "a version-chain SUPERSEDES relation."
                            ),
                        )
                    )

                reason = (
                    "Backend atomic version policy applied: "
                    "cross-type version update was converted to "
                    "independent knowledge. "
                    f"candidate_type={candidate.knowledge_type}, "
                    f"target_type={target.knowledge_type}, "
                    f"proposal_type={proposal.type}, "
                    f"original_operation={ai_result.operation}."
                )

                return (
                    KnowledgeSynthesisAIResponse(
                        operation="MERGE",
                        target_knowledge_ids=[],
                        synthesized_knowledge_units=[
                            _candidate_to_synthesized_unit(
                                candidate
                            )
                        ],
                        relations=relations,
                        reason=reason,
                    ),
                    reason,
                )

    if (
        ai_result.operation == "MERGE"
        and related_knowledge
    ):
        relations: list[ProposedSynthesisRelation] = []
        seen: set[tuple[int, uuid.UUID, str]] = set()

        for relation in ai_result.relations:
            relation_type = relation.relation

            if relation_type == "SUPERSEDES":
                relation_type = "REFINES"

            key = (
                0,
                relation.target_knowledge_id,
                relation_type,
            )

            if key in seen:
                continue

            seen.add(key)
            relations.append(
                ProposedSynthesisRelation(
                    synthesized_index=0,
                    target_knowledge_id=(
                        relation.target_knowledge_id
                    ),
                    relation=relation_type,
                    reason=relation.reason,
                )
            )

        reason = (
            "Backend atomic MERGE policy applied: existing "
            "knowledge is not superseded by MERGE; the Candidate "
            "is preserved as one independent Knowledge Unit."
        )

        return (
            KnowledgeSynthesisAIResponse(
                operation="MERGE",
                target_knowledge_ids=[],
                synthesized_knowledge_units=[
                    _candidate_to_synthesized_unit(candidate)
                ],
                relations=relations,
                reason=reason,
            ),
            reason,
        )

    return ai_result, None


def _get_related_knowledge(
    db: Session,
    mission_id: uuid.UUID,
    candidate: KnowledgeCandidate,
    requested_ids: list[uuid.UUID],
    use_mission_fallback: bool = True,
) -> list[KnowledgeUnit]:

    # ------------------------------------------------------
    # related_knowledge_ids가 지정된 경우
    # 해당 Knowledge만 사용
    # ------------------------------------------------------
    if requested_ids:
        rows = (
            db.query(KnowledgeUnit)
            .filter(
                KnowledgeUnit.knowledge_id.in_(
                    requested_ids
                )
            )
            .all()
        )

        row_map = {
            row.knowledge_id: row
            for row in rows
        }

        missing = [
            knowledge_id
            for knowledge_id in requested_ids
            if knowledge_id not in row_map
        ]

        if missing:
            raise HTTPException(
                status_code=(
                    status.HTTP_404_NOT_FOUND
                ),
                detail=(
                    "Related knowledge unit "
                    f"not found: {missing[0]}"
                ),
            )

        result = []

        for knowledge_id in requested_ids:
            row = row_map[knowledge_id]

            if row.mission_id != mission_id:
                raise HTTPException(
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    ),
                    detail=(
                        "Related knowledge must "
                        "belong to the same mission"
                    ),
                )

            if (
                row.status
                not in ACTIVE_KNOWLEDGE_STATUSES
            ):
                raise HTTPException(
                    status_code=(
                        status.HTTP_409_CONFLICT
                    ),
                    detail=(
                        "Related knowledge unit "
                        f"{knowledge_id} is not active"
                    ),
                )

            result.append(row)

        return result

    # ------------------------------------------------------
    # Auto Knowledge Sync 전용
    #
    # 선별된 관련 Knowledge가 실제로 0개라면
    # Mission 전체 Knowledge를 fallback으로 넣지 않는다.
    # ------------------------------------------------------
    if not use_mission_fallback:
        return []

    # ------------------------------------------------------
    # Swagger/manual/review 재-Synthesis 안전 fallback
    #
    # Mission 전체 Knowledge를 AI에 넘기지 않고, Candidate와 의미
    # 신호가 있는 활성 Knowledge 최대 1개만 전달한다.
    # ------------------------------------------------------
    return _get_safe_fallback_related_knowledge(
        db=db,
        mission_id=mission_id,
        candidate=candidate,
    )


def synthesize_candidate(
    db: Session,
    candidate_id: uuid.UUID,
    request: KnowledgeSynthesisRequest,
    use_mission_fallback: bool = True,
) -> KnowledgeSynthesisResponse:

    candidate = (
        db.query(KnowledgeCandidate)
        .filter(
            KnowledgeCandidate.candidate_id
            == candidate_id
        )
        .first()
    )

    if candidate is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Knowledge candidate not found"
            ),
        )

    analysis = (
        db.query(InterviewAnalysis)
        .filter(
            InterviewAnalysis.analysis_id
            == candidate.analysis_id
        )
        .first()
    )

    if analysis is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Interview analysis not found"
            ),
        )

    related_knowledge = (
        _get_related_knowledge(
            db=db,
            mission_id=analysis.mission_id,
            candidate=candidate,
            requested_ids=(
                request.related_knowledge_ids
            ),
            use_mission_fallback=(
                use_mission_fallback
            ),
        )
    )

    ai_request = KnowledgeSynthesisAIRequest(
        candidate=_candidate_to_ai(
            candidate
        ),
        existing_knowledge=[
            _knowledge_to_ai(row)
            for row in related_knowledge
        ],
    )

    try:
        ai_result = (
            ai_client.synthesize_knowledge(
                request=ai_request
            )
        )

    except AIClientError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "AI knowledge synthesis "
                f"service error: {str(exc)}"
            ),
        )

    # AI 원본 응답은 provenance/debugging을 위해 별도로 보존한다.
    raw_ai_response = (
        ai_result.model_dump(
            mode="json"
        )
    )

    # ------------------------------------------------------
    # Backend EXCEPTION preservation policy
    #
    # EXCEPTION Candidate를 기존 Rule/Principle의 새 Version에
    # 흡수하지 않고 독립 EXCEPTION + HAS_EXCEPTION으로 보존한다.
    # ------------------------------------------------------
    policy_reasons: list[str] = []

    ai_result, exception_policy_reason = (
        _normalize_exception_synthesis(
            candidate=candidate,
            related_knowledge=related_knowledge,
            ai_result=ai_result,
        )
    )

    if exception_policy_reason is not None:
        policy_reasons.append(exception_policy_reason)

    ai_result, atomic_policy_reason = (
        _normalize_atomic_version_policy(
            candidate=candidate,
            related_knowledge=related_knowledge,
            ai_result=ai_result,
        )
    )

    if atomic_policy_reason is not None:
        policy_reasons.append(atomic_policy_reason)

    allowed_target_ids = {
        row.knowledge_id
        for row in related_knowledge
    }

    # ------------------------------------------------------
    # AI/정책 결과가 Backend에서 전달하지 않은 Knowledge ID를
    # Relation 대상으로 반환하는 것 방지
    # ------------------------------------------------------
    for target_id in (
        ai_result.target_knowledge_ids
    ):
        if target_id not in allowed_target_ids:
            raise HTTPException(
                status_code=(
                    status.HTTP_502_BAD_GATEWAY
                ),
                detail=(
                    "AI synthesis returned an "
                    "unknown target_knowledge_id"
                ),
            )

    unit_count = len(
        ai_result.synthesized_knowledge_units
    )

    for relation in ai_result.relations:

        if (
            relation.synthesized_index
            >= unit_count
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_502_BAD_GATEWAY
                ),
                detail=(
                    "AI synthesis returned an "
                    "invalid synthesized_index"
                ),
            )

        if (
            relation.target_knowledge_id
            not in allowed_target_ids
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_502_BAD_GATEWAY
                ),
                detail=(
                    "AI synthesis relation "
                    "references unknown knowledge"
                ),
            )

    try:
        raw_response_payload = (
            dict(raw_ai_response)
        )

        if policy_reasons:
            raw_response_payload[
                "_backend_policy"
            ] = {
                "names": [
                    "EXCEPTION_PRESERVATION",
                    "ATOMIC_VERSION_CHAIN",
                ],
                "reasons": policy_reasons,
                "normalized_result": (
                    ai_result.model_dump(
                        mode="json"
                    )
                ),
            }

        synthesis = KnowledgeSynthesis(
            mission_id=analysis.mission_id,
            candidate_id=candidate.candidate_id,
            operation=ai_result.operation,
            target_knowledge_ids=[
                str(item)
                for item
                in ai_result.target_knowledge_ids
            ],
            reason=ai_result.reason,
            request_payload=(
                ai_request.model_dump(
                    mode="json"
                )
            ),
            raw_response=(
                raw_response_payload
            ),
        )

        db.add(synthesis)
        db.flush()

        # STALE 처리 후 사람이 재-Synthesis한 Candidate라면
        # Review Queue가 새 Synthesis를 가리키도록 즉시 재연결한다.
        _attach_review_synthesis_if_waiting(
            candidate=candidate,
            synthesis=synthesis,
        )

        stored_units = []

        for index, item in enumerate(
            ai_result
            .synthesized_knowledge_units
        ):
            row = KnowledgeSynthesisUnit(
                synthesis_id=(
                    synthesis.synthesis_id
                ),
                synthesized_index=index,
                statement=item.statement,
                knowledge_type=item.type,
                context=(
                    item.context.model_dump(
                        mode="json"
                    )
                ),
                decision_rule=(
                    item.decision_rule.model_dump(
                        mode="json"
                    )
                    if item.decision_rule
                    is not None
                    else None
                ),
                rationale=item.rationale,
                exception=item.exception,
                novelty_score=(
                    item.novelty_score
                ),
                confidence_score=(
                    item.confidence_score
                ),
                validation_status=(
                    item.validation_status
                ),
            )

            db.add(row)
            db.flush()

            stored_units.append(
                StoredSynthesizedKnowledgeUnit(
                    synthesis_unit_id=(
                        row.synthesis_unit_id
                    ),
                    synthesized_index=index,
                    statement=item.statement,
                    type=item.type,
                    context=item.context,
                    decision_rule=(
                        item.decision_rule
                    ),
                    rationale=item.rationale,
                    exception=item.exception,
                    novelty_score=(
                        item.novelty_score
                    ),
                    confidence_score=(
                        item.confidence_score
                    ),
                    validation_status=(
                        item.validation_status
                    ),
                )
            )

        stored_relations = []

        for item in ai_result.relations:

            row = KnowledgeSynthesisRelation(
                synthesis_id=(
                    synthesis.synthesis_id
                ),
                synthesized_index=(
                    item.synthesized_index
                ),
                target_knowledge_id=(
                    item.target_knowledge_id
                ),
                relation_type=(
                    item.relation
                ),
                reason=item.reason,
            )

            db.add(row)
            db.flush()

            stored_relations.append(
                StoredSynthesisRelation(
                    synthesis_relation_id=(
                        row.synthesis_relation_id
                    ),
                    synthesized_index=(
                        row.synthesized_index
                    ),
                    target_knowledge_id=(
                        row.target_knowledge_id
                    ),
                    relation=row.relation_type,
                    reason=row.reason,
                )
            )

        db.commit()
        db.refresh(synthesis)

        return KnowledgeSynthesisResponse(
            synthesis_id=(
                synthesis.synthesis_id
            ),
            candidate_id=(
                candidate.candidate_id
            ),
            mission_id=(
                analysis.mission_id
            ),
            operation=(
                ai_result.operation
            ),
            target_knowledge_ids=(
                ai_result
                .target_knowledge_ids
            ),
            synthesized_knowledge_units=(
                stored_units
            ),
            relations=stored_relations,
            reason=ai_result.reason,
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Knowledge synthesis save failed: "
                f"{str(exc)}"
            ),
        )
