# Final Review policy: duplicate/no-op reuse may complete automatically, but every new or materially changed knowledge synthesis requires Human Review before VERIFIED apply.
# Orchestrates candidate idempotency, duplicate suppression, synthesis preparation, review routing, and no-op reuse.

import logging
import re
import uuid
from typing import Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.interview_analysis import InterviewAnalysis, KnowledgeCandidate
from app.models.knowledge_core import KnowledgeUnit
from app.models.knowledge_synthesis import KnowledgeSynthesis, KnowledgeSynthesisUnit
from app.schemas.knowledge_synthesis import AutoKnowledgeSyncItem, AutoKnowledgeSyncResponse, KnowledgeSynthesisRequest
from app.schemas.knowledge_synthesis_apply import KnowledgeSynthesisValidationRequest
from app.services.knowledge_duplicate_service import (
    RULE_LIKE_KNOWLEDGE_TYPES,
    assess_synthesized_unit_material_change,
    find_duplicate_active_knowledge,
    reuse_existing_knowledge_for_duplicate,
)
from app.services.knowledge_synthesis_apply_service import validate_and_apply_synthesis
from app.services.knowledge_synthesis_service import ACTIVE_KNOWLEDGE_STATUSES, synthesize_candidate
logger = logging.getLogger(__name__)
AUTO_VALIDATED_BY = 'K-DNA AUTO'
AUTO_NOOP_REUSE_REASON = 'No material knowledge change; reuse existing verified knowledge and attach interview evidence'
AUTO_RETRY_REJECT_REASON = 'Unsafe automatic synthesis was rejected and regenerated with narrowed knowledge context'
RELATED_KNOWLEDGE_LIMIT = 1
MIN_STATEMENT_JACCARD = 0.1

# --- Generic helpers ---
def _to_uuid_list(values: Any) -> list[uuid.UUID]:
    result: list[uuid.UUID] = []
    for value in values or []:
        try:
            result.append(uuid.UUID(str(value)))
        except (ValueError, TypeError, AttributeError):
            continue
    return result

def _normalize_text(value: str | None) -> set[str]:
    if not value:
        return set()
    tokens = re.findall('[A-Za-z0-9가-힣_]+', value.lower())
    return {token for token in tokens if len(token) >= 2}

def _list_to_tokens(values: Any) -> set[str]:
    result: set[str] = set()
    if not isinstance(values, list):
        return result
    for value in values:
        if isinstance(value, str):
            result.update(_normalize_text(value))
    return result

def _candidate_context_value(candidate: KnowledgeCandidate, key: str) -> Any:
    context = candidate.context or {}
    return context.get(key)

def _knowledge_context_value(knowledge: KnowledgeUnit, key: str) -> Any:
    context = knowledge.context or {}
    return context.get(key)

def _same_context_value(candidate: KnowledgeCandidate, knowledge: KnowledgeUnit, key: str) -> bool:
    candidate_value = _candidate_context_value(candidate, key)
    knowledge_value = _knowledge_context_value(knowledge, key)
    if not candidate_value:
        return False
    if not knowledge_value:
        return False
    return str(candidate_value).strip().lower() == str(knowledge_value).strip().lower()

def _statement_jaccard(candidate: KnowledgeCandidate, knowledge: KnowledgeUnit) -> float:
    candidate_tokens = _normalize_text(candidate.statement)
    knowledge_tokens = _normalize_text(knowledge.statement)
    if not candidate_tokens or not knowledge_tokens:
        return 0.0
    union = candidate_tokens | knowledge_tokens
    if not union:
        return 0.0
    intersection = candidate_tokens & knowledge_tokens
    return len(intersection) / len(union)

def _has_meaningful_relevance_signal(candidate: KnowledgeCandidate, knowledge: KnowledgeUnit) -> bool:
    candidate_tags = _list_to_tokens(_candidate_context_value(candidate, 'tags'))
    knowledge_tags = _list_to_tokens(_knowledge_context_value(knowledge, 'tags'))
    tag_overlap = candidate_tags & knowledge_tags
    if tag_overlap:
        return True
    jaccard = _statement_jaccard(candidate=candidate, knowledge=knowledge)
    if jaccard >= MIN_STATEMENT_JACCARD:
        return True
    same_system = _same_context_value(candidate=candidate, knowledge=knowledge, key='system')
    same_scope = _same_context_value(candidate=candidate, knowledge=knowledge, key='scope')
    if same_system and same_scope:
        return True
    return False

def _knowledge_relevance_score(candidate: KnowledgeCandidate, knowledge: KnowledgeUnit) -> float | None:
    if not _has_meaningful_relevance_signal(candidate=candidate, knowledge=knowledge):
        return None
    score = 0.0
    if candidate.knowledge_type == knowledge.knowledge_type:
        score += 1.5
    context_weights = {'domain': 1.0, 'system': 1.5, 'phase': 1.0, 'scope': 1.5, 'project': 1.0}
    for key, weight in context_weights.items():
        if _same_context_value(candidate=candidate, knowledge=knowledge, key=key):
            score += weight
    candidate_tags = _list_to_tokens(_candidate_context_value(candidate, 'tags'))
    knowledge_tags = _list_to_tokens(_knowledge_context_value(knowledge, 'tags'))
    tag_overlap = candidate_tags & knowledge_tags
    score += min(float(len(tag_overlap) * 2), 6.0)
    jaccard = _statement_jaccard(candidate=candidate, knowledge=knowledge)
    score += jaccard * 5.0
    return score

# --- Related Knowledge selection ---
def _get_related_knowledge_ids(db: Session, mission_id: uuid.UUID, candidate: KnowledgeCandidate) -> list[uuid.UUID]:
    rows = db.query(KnowledgeUnit).filter(KnowledgeUnit.mission_id == mission_id, KnowledgeUnit.status.in_(ACTIVE_KNOWLEDGE_STATUSES)).order_by(KnowledgeUnit.updated_at.desc()).all()
    if not rows:
        return []
    scored: list[tuple[float, KnowledgeUnit]] = []
    for knowledge in rows:
        score = _knowledge_relevance_score(candidate=candidate, knowledge=knowledge)
        if score is None:
            continue
        scored.append((score, knowledge))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [knowledge.knowledge_id for _, knowledge in scored[:RELATED_KNOWLEDGE_LIMIT]]

# --- Synthesis / idempotency helpers ---
def _get_candidate_syntheses(db: Session, candidate_id: uuid.UUID) -> list[KnowledgeSynthesis]:
    return db.query(KnowledgeSynthesis).filter(KnowledgeSynthesis.candidate_id == candidate_id).order_by(KnowledgeSynthesis.created_at.desc()).all()

def _find_applied_synthesis(syntheses: list[KnowledgeSynthesis]) -> KnowledgeSynthesis | None:
    for synthesis in syntheses:
        if synthesis.status == 'APPLIED':
            return synthesis
    return None

def _find_reusable_synthesis(syntheses: list[KnowledgeSynthesis]) -> KnowledgeSynthesis | None:
    for synthesis in syntheses:
        if synthesis.status in {'PENDING', 'APPROVED'}:
            return synthesis
    return None

def _has_human_rejected_synthesis(syntheses: list[KnowledgeSynthesis]) -> bool:
    for synthesis in syntheses:
        if synthesis.status != 'REJECTED':
            continue
        if synthesis.validated_by != AUTO_VALIDATED_BY:
            return True
    return False

def _find_existing_candidate_knowledge(db: Session, candidate_id: uuid.UUID) -> list[KnowledgeUnit]:
    return db.query(KnowledgeUnit).filter(KnowledgeUnit.source_candidate_id == candidate_id).all()

def _get_synthesis_targets(db: Session, synthesis: KnowledgeSynthesis) -> list[KnowledgeUnit]:
    target_ids = _to_uuid_list(synthesis.target_knowledge_ids)
    if not target_ids:
        return []
    rows = db.query(KnowledgeUnit).filter(KnowledgeUnit.knowledge_id.in_(target_ids)).all()
    row_map = {row.knowledge_id: row for row in rows}
    return [row_map[target_id] for target_id in target_ids if target_id in row_map]

def _get_requested_existing_knowledge_ids(synthesis: KnowledgeSynthesis) -> list[uuid.UUID]:
    request_payload = synthesis.request_payload or {}
    existing_knowledge = request_payload.get('existing_knowledge', [])
    if not isinstance(existing_knowledge, list):
        return []
    result: list[uuid.UUID] = []
    for item in existing_knowledge:
        if not isinstance(item, dict):
            continue
        knowledge_id = item.get('knowledge_id')
        if knowledge_id is None:
            continue
        try:
            result.append(uuid.UUID(str(knowledge_id)))
        except (ValueError, TypeError, AttributeError):
            continue
    return result

def _get_synthesis_unit_count(
    db: Session,
    synthesis: KnowledgeSynthesis,
) -> int:
    return int(
        db.query(KnowledgeSynthesisUnit)
        .filter(
            KnowledgeSynthesisUnit.synthesis_id
            == synthesis.synthesis_id
        )
        .count()
    )


def _get_synthesis_units(
    db: Session,
    synthesis: KnowledgeSynthesis,
) -> list[KnowledgeSynthesisUnit]:
    return (
        db.query(KnowledgeSynthesisUnit)
        .filter(
            KnowledgeSynthesisUnit.synthesis_id
            == synthesis.synthesis_id
        )
        .order_by(
            KnowledgeSynthesisUnit.synthesized_index.asc()
        )
        .all()
    )


def _mark_review_required(
    db: Session,
    candidate: KnowledgeCandidate,
    reason: str,
    synthesis_id: uuid.UUID | None,
) -> None:
    """
    새로 생성되거나 기존 지식을 실질적으로 변경하는 Candidate를
    Human Review Queue에 영속화한다.

    최종 표준 경로에서는 가능한 경우 Synthesis를 먼저 생성한 뒤
    review_synthesis_id에 해당 synthesis_id를 저장한다.
    """
    candidate.review_status = "REVIEW_REQUIRED"
    candidate.review_reason = reason
    candidate.review_synthesis_id = synthesis_id
    db.commit()
    db.refresh(candidate)

# --- Auto-operation normalization and safety ---
def _normalize_auto_operation(db: Session, synthesis: KnowledgeSynthesis) -> str | None:
    """
    AI operation 중 Backend가 안전하게 의미를 확정할 수 있는
    경우만 Auto Pipeline에서 정규화한다.

    원본 AI 응답(raw_response)은 수정하지 않는다.

    1. ENRICH / SUPERSEDE + target 누락
       - existing=0 -> 신규 지식이므로 MERGE
       - existing=1 -> 유일한 existing을 target으로 채움

    2. MERGE + existing Knowledge 1개 + proposal 1개
       - Auto path가 이미 관련 Knowledge 1개만 선별해 AI에 전달한
         상태이므로, 병렬 독립 v1을 만드는 대신 기존 Knowledge의
         다음 Version인 ENRICH로 정규화
       - 단, Duplicate는 이 단계보다 앞에서 기존 Knowledge 재사용으로
         종료되므로 실제 새 정보가 남은 경우에만 version update가 된다.

    MERGE + existing 여러 개, proposal 여러 개 등
    의미가 모호한 경우는 여기서 보정하지 않고 Guardrail로
    넘겨 REVIEW_REQUIRED 처리한다.
    """
    existing_ids = _get_requested_existing_knowledge_ids(synthesis)
    target_ids = _to_uuid_list(synthesis.target_knowledge_ids)
    proposal_count = _get_synthesis_unit_count(db=db, synthesis=synthesis)
    if synthesis.operation in {'ENRICH', 'SUPERSEDE'}:
        if target_ids:
            return None
        if len(existing_ids) == 0:
            original_operation = synthesis.operation
            synthesis.operation = 'MERGE'
            db.flush()
            detail = f'Auto-normalized synthesis operation {original_operation} -> MERGE because no existing knowledge was supplied'
            logger.info('%s synthesis_id=%s', detail, synthesis.synthesis_id)
            return detail
        if len(existing_ids) == 1:
            target_id = existing_ids[0]
            synthesis.target_knowledge_ids = [str(target_id)]
            db.flush()
            detail = f'Auto-filled missing target for {synthesis.operation} with the only supplied existing knowledge {target_id}'
            logger.info('%s synthesis_id=%s', detail, synthesis.synthesis_id)
            return detail
        return None
    if synthesis.operation == 'MERGE':
        if len(existing_ids) == 1 and proposal_count == 1 and (len(target_ids) <= 1):
            existing_id = existing_ids[0]
            if target_ids and target_ids[0] != existing_id:
                return None
            synthesis.operation = 'ENRICH'
            synthesis.target_knowledge_ids = [str(existing_id)]
            db.flush()
            detail = f'Auto-normalized synthesis operation MERGE -> ENRICH because exactly one existing knowledge and one synthesized unit were supplied; target={existing_id}'
            logger.info('%s synthesis_id=%s', detail, synthesis.synthesis_id)
            return detail
    return None

def _check_auto_apply_safety(
    db: Session,
    synthesis: KnowledgeSynthesis,
) -> tuple[bool, str | None]:
    targets = _get_synthesis_targets(
        db=db,
        synthesis=synthesis,
    )
    existing_ids = _get_requested_existing_knowledge_ids(
        synthesis
    )
    proposals = _get_synthesis_units(
        db=db,
        synthesis=synthesis,
    )
    proposal_count = len(proposals)
    operation = synthesis.operation

    if operation == 'KEEP_CONFLICT':
        return (
            False,
            (
                'KEEP_CONFLICT requires manual review '
                'and cannot be automatically applied'
            ),
        )

    if operation == 'SPLIT_BY_CONTEXT':
        return (
            False,
            (
                'SPLIT_BY_CONTEXT requires manual review '
                'and cannot be automatically applied'
            ),
        )

    if operation in {'ENRICH', 'SUPERSEDE'}:
        if len(targets) != 1 or proposal_count != 1:
            return (
                False,
                (
                    f'{operation} requires exactly one target '
                    'and one synthesized unit for automatic apply'
                ),
            )

        target = targets[0]
        proposal = proposals[0]

        # EXCEPTION -> PRINCIPLE, FAILURE_LESSON -> DECISION_RULE처럼
        # Knowledge family 자체가 바뀌는 version update는 Root가
        # 다른 지식을 흡수하는 mega-knowledge가 될 수 있으므로
        # 자동 적용하지 않는다.
        if target.knowledge_type != proposal.knowledge_type:
            target_rule_like = (
                target.knowledge_type
                in RULE_LIKE_KNOWLEDGE_TYPES
            )
            proposal_rule_like = (
                proposal.knowledge_type
                in RULE_LIKE_KNOWLEDGE_TYPES
            )

            if not (
                target_rule_like
                and proposal_rule_like
            ):
                return (
                    False,
                    (
                        'Cross-family knowledge_type version update '
                        'requires manual review: '
                        f'{target.knowledge_type} -> '
                        f'{proposal.knowledge_type}'
                    ),
                )

    if operation == 'ADD_EXCEPTION':
        if len(targets) != 1 or proposal_count != 1:
            return (
                False,
                (
                    'ADD_EXCEPTION requires exactly one target '
                    'and one synthesized unit for automatic apply'
                ),
            )

    if operation == 'MERGE':
        if existing_ids:
            return (
                False,
                (
                    'Automatic MERGE is allowed only for '
                    'brand-new knowledge with no existing knowledge'
                ),
            )

        if targets:
            return (
                False,
                (
                    'Automatic MERGE is allowed only when '
                    'there is no target knowledge'
                ),
            )

        if proposal_count != 1:
            return (
                False,
                (
                    'Automatic MERGE requires exactly one '
                    'synthesized unit'
                ),
            )

    return (True, None)

# --- Synthesis creation / retry ---
def _create_auto_synthesis(db: Session, mission_id: uuid.UUID, candidate: KnowledgeCandidate) -> KnowledgeSynthesis:
    related_knowledge_ids = _get_related_knowledge_ids(db=db, mission_id=mission_id, candidate=candidate)
    synthesis_result = synthesize_candidate(db=db, candidate_id=candidate.candidate_id, request=KnowledgeSynthesisRequest(related_knowledge_ids=related_knowledge_ids), use_mission_fallback=False)
    synthesis = db.query(KnowledgeSynthesis).filter(KnowledgeSynthesis.synthesis_id == synthesis_result.synthesis_id).first()
    if synthesis is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Created synthesis could not be reloaded')
    return synthesis

def _retry_unsafe_synthesis(db: Session, mission_id: uuid.UUID, candidate: KnowledgeCandidate, synthesis: KnowledgeSynthesis) -> tuple[KnowledgeSynthesis | None, str | None]:
    if synthesis.operation in {'KEEP_CONFLICT', 'SPLIT_BY_CONTEXT'}:
        return (None, None)
    existing_ids = _get_requested_existing_knowledge_ids(synthesis)
    target_ids = _to_uuid_list(synthesis.target_knowledge_ids)
    if len(existing_ids) <= 1 and len(target_ids) <= 1:
        return (None, None)
    old_synthesis_id = synthesis.synthesis_id
    validate_and_apply_synthesis(db=db, synthesis_id=old_synthesis_id, request=KnowledgeSynthesisValidationRequest(decision='REJECT', reason=AUTO_RETRY_REJECT_REASON, validated_by=AUTO_VALIDATED_BY))
    new_synthesis = _create_auto_synthesis(db=db, mission_id=mission_id, candidate=candidate)
    detail = f'Unsafe multi-knowledge synthesis {old_synthesis_id} was rejected and regenerated with at most one related knowledge'
    logger.info('%s new_synthesis_id=%s', detail, new_synthesis.synthesis_id)
    return (new_synthesis, detail)

# --- Public orchestration entry point ---
def sync_analysis_to_knowledge(db: Session, analysis_id: uuid.UUID) -> AutoKnowledgeSyncResponse:
    analysis = db.query(InterviewAnalysis).filter(InterviewAnalysis.analysis_id == analysis_id).first()
    if analysis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Interview analysis not found')
    candidate_ids = [
        row.candidate_id
        for row in (
            db.query(KnowledgeCandidate)
            .filter(
                KnowledgeCandidate.analysis_id
                == analysis_id
            )
            .order_by(
                KnowledgeCandidate.created_at.asc()
            )
            .all()
        )
    ]


    processed = 0
    skipped = 0
    review_required = 0
    failed = 0
    items: list[AutoKnowledgeSyncItem] = []
    duplicate_embedding_cache: dict[str, list[float]] = {}
    for candidate_id in candidate_ids:
        synthesis_id: uuid.UUID | None = None
        detail_messages: list[str] = []
        try:
            candidate = db.query(KnowledgeCandidate).filter(KnowledgeCandidate.candidate_id == candidate_id).first()
            if candidate is None:
                failed += 1
                items.append(AutoKnowledgeSyncItem(candidate_id=candidate_id, status='FAILED', synthesis_id=None, resulting_knowledge_ids=[], detail='Knowledge candidate not found'))
                continue
            syntheses = _get_candidate_syntheses(db=db, candidate_id=candidate_id)
            applied_synthesis = _find_applied_synthesis(syntheses)
            if applied_synthesis is not None:
                skipped += 1
                items.append(AutoKnowledgeSyncItem(candidate_id=candidate_id, status='SKIPPED', synthesis_id=applied_synthesis.synthesis_id, resulting_knowledge_ids=_to_uuid_list(applied_synthesis.resulting_knowledge_ids), detail='Candidate already has an APPLIED synthesis'))
                continue
            existing_candidate_knowledge = _find_existing_candidate_knowledge(db=db, candidate_id=candidate_id)
            if existing_candidate_knowledge:
                skipped += 1
                items.append(AutoKnowledgeSyncItem(candidate_id=candidate_id, status='SKIPPED', synthesis_id=None, resulting_knowledge_ids=[row.knowledge_id for row in existing_candidate_knowledge], detail='Candidate already has a Knowledge Unit'))
                continue
            if _has_human_rejected_synthesis(syntheses):
                skipped += 1
                items.append(AutoKnowledgeSyncItem(candidate_id=candidate_id, status='SKIPPED', synthesis_id=None, resulting_knowledge_ids=[], detail='Candidate has a human-rejected synthesis'))
                continue
            reusable_synthesis = _find_reusable_synthesis(syntheses)
            if reusable_synthesis is None:
                duplicate_match = find_duplicate_active_knowledge(db=db, mission_id=analysis.mission_id, candidate=candidate, embedding_cache=duplicate_embedding_cache)
                if duplicate_match is not None:
                    reuse_existing_knowledge_for_duplicate(db=db, analysis=analysis, candidate=candidate, match=duplicate_match)
                    skipped += 1
                    items.append(AutoKnowledgeSyncItem(candidate_id=candidate_id, status='SKIPPED', synthesis_id=None, resulting_knowledge_ids=[duplicate_match.knowledge.knowledge_id], detail=f'Duplicate knowledge suppressed and existing Knowledge Unit reused. match_type={duplicate_match.match_type}, sequence_ratio={duplicate_match.sequence_ratio:.4f}, token_jaccard={duplicate_match.token_jaccard:.4f}, token_containment={duplicate_match.token_containment:.4f}, char_containment={duplicate_match.char_containment:.4f}, semantic_similarity={duplicate_match.semantic_similarity}, combined_score={duplicate_match.combined_score:.4f}, knowledge_id={duplicate_match.knowledge.knowledge_id}'))
                    continue
            if reusable_synthesis is not None:
                synthesis = reusable_synthesis
            else:
                synthesis = _create_auto_synthesis(db=db, mission_id=analysis.mission_id, candidate=candidate)
            synthesis_id = synthesis.synthesis_id
            normalization_detail = _normalize_auto_operation(db=db, synthesis=synthesis)
            if normalization_detail:
                detail_messages.append(normalization_detail)
            safe, safety_reason = _check_auto_apply_safety(db=db, synthesis=synthesis)
            if not safe:
                retried_synthesis, retry_detail = _retry_unsafe_synthesis(db=db, mission_id=analysis.mission_id, candidate=candidate, synthesis=synthesis)
                if retried_synthesis is not None:
                    synthesis = retried_synthesis
                    synthesis_id = synthesis.synthesis_id
                    if retry_detail:
                        detail_messages.append(retry_detail)
                    normalization_detail = _normalize_auto_operation(db=db, synthesis=synthesis)
                    if normalization_detail:
                        detail_messages.append(normalization_detail)
                    safe, safety_reason = _check_auto_apply_safety(db=db, synthesis=synthesis)
            if not safe:
                review_reason = (
                    safety_reason
                    or 'Automatic apply guardrail requires manual review'
                )
                _mark_review_required(
                    db=db,
                    candidate=candidate,
                    reason=review_reason,
                    synthesis_id=synthesis_id,
                )
                review_required += 1
                items.append(AutoKnowledgeSyncItem(candidate_id=candidate_id, status='REVIEW_REQUIRED', synthesis_id=synthesis_id, resulting_knowledge_ids=[], detail=review_reason))
                continue
            # --------------------------------------------------
            # Post-synthesis no-op suppression
            # --------------------------------------------------
            # Candidate 자체는 새로워 보여도 Synthesis 결과가 기존
            # Knowledge의 단순 재서술이면 새 Version을 만들 필요가 없다.
            # 이 경우에만 예외적으로 Human Review 없이 기존 VERIFIED
            # Knowledge를 재사용하고 이번 Interview Message를 Evidence로
            # 누적한다.
            if synthesis.operation in {
                'ENRICH',
                'SUPERSEDE',
            }:
                version_targets = _get_synthesis_targets(
                    db=db,
                    synthesis=synthesis,
                )
                version_proposals = _get_synthesis_units(
                    db=db,
                    synthesis=synthesis,
                )

                if (
                    len(version_targets) == 1
                    and len(version_proposals) == 1
                ):
                    material_assessment = (
                        assess_synthesized_unit_material_change(
                            target=version_targets[0],
                            proposal=version_proposals[0],
                            embedding_cache=(
                                duplicate_embedding_cache
                            ),
                        )
                    )

                    if not material_assessment.material_change:
                        apply_result = (
                            validate_and_apply_synthesis(
                                db=db,
                                synthesis_id=synthesis_id,
                                request=(
                                    KnowledgeSynthesisValidationRequest(
                                        decision='APPROVE',
                                        reason=(
                                            AUTO_NOOP_REUSE_REASON
                                        ),
                                        validated_by=(
                                            AUTO_VALIDATED_BY
                                        ),
                                    )
                                ),
                                material_change_embedding_cache=(
                                    duplicate_embedding_cache
                                ),
                            )
                        )

                        skipped += 1
                        detail_messages.insert(
                            0,
                            (
                                'Synthesized proposal produced no '
                                'material knowledge change; existing '
                                'VERIFIED Knowledge Unit reused'
                            ),
                        )
                        detail_messages.append(
                            material_assessment.reason
                        )

                        items.append(
                            AutoKnowledgeSyncItem(
                                candidate_id=candidate_id,
                                status='SKIPPED',
                                synthesis_id=synthesis_id,
                                resulting_knowledge_ids=(
                                    apply_result
                                    .resulting_knowledge_ids
                                ),
                                detail='. '.join(
                                    detail_messages
                                ),
                            )
                        )
                        continue

            # --------------------------------------------------
            # Final policy: Human Review before VERIFIED
            # --------------------------------------------------
            # Duplicate/no-op이 아닌 모든 신규/실질 변경 Candidate는
            # Synthesis까지만 자동 준비하고 여기서 멈춘다.
            # 실제 Knowledge Unit 생성, Version 변경, Relation 적용,
            # VERIFIED 승격은 Review 화면의 Accurate(APPROVE) 이후에만
            # validate_and_apply_synthesis()가 수행한다.
            review_reason = (
                'Human review is required before applying synthesized '
                'knowledge and promoting the candidate to VERIFIED'
            )

            _mark_review_required(
                db=db,
                candidate=candidate,
                reason=review_reason,
                synthesis_id=synthesis_id,
            )

            review_required += 1
            detail_messages.insert(
                0,
                (
                    'Candidate synthesized successfully; awaiting '
                    'Human Review before Knowledge Unit apply/VERIFIED'
                ),
            )

            items.append(
                AutoKnowledgeSyncItem(
                    candidate_id=candidate_id,
                    status='REVIEW_REQUIRED',
                    synthesis_id=synthesis_id,
                    resulting_knowledge_ids=[],
                    detail='. '.join(detail_messages),
                )
            )
        except HTTPException as exc:
            db.rollback()
            failed += 1
            items.append(AutoKnowledgeSyncItem(candidate_id=candidate_id, status='FAILED', synthesis_id=synthesis_id, resulting_knowledge_ids=[], detail=str(exc.detail)))
        except Exception as exc:
            db.rollback()
            failed += 1
            items.append(AutoKnowledgeSyncItem(candidate_id=candidate_id, status='FAILED', synthesis_id=synthesis_id, resulting_knowledge_ids=[], detail=str(exc)))
    return AutoKnowledgeSyncResponse(analysis_id=analysis_id, mission_id=analysis.mission_id, total_candidates=len(candidate_ids), processed=processed, skipped=skipped, review_required=review_required, failed=failed, items=items)
