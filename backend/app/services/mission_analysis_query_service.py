import uuid
from collections import defaultdict

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.interview_analysis import (
    ConflictSource,
    InterviewAnalysis,
    KnowledgeConflict,
    KnowledgeGap,
)
from app.schemas.mission_analysis import (
    MissionConflictSourceResponse,
    MissionKnowledgeConflictListResponse,
    MissionKnowledgeConflictResponse,
    MissionKnowledgeGapListResponse,
    MissionKnowledgeGapResponse,
)
from app.services.conflict_normalization_service import (
    build_conflict_canonicalization_record,
    resolve_conflict_source_type,
    select_visible_conflict_ids,
)
from app.services.mission_service import get_mission


def _validate_mission(
    db: Session,
    mission_id: uuid.UUID,
) -> None:
    mission = get_mission(
        db=db,
        mission_id=mission_id,
    )

    if mission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )


def get_mission_gaps(
    db: Session,
    mission_id: uuid.UUID,
) -> MissionKnowledgeGapListResponse:
    """
    Mission에 속한 모든 Interview에서 생성된
    Knowledge Gap을 통합 조회한다.

    최신 Gap부터 반환한다.
    """

    _validate_mission(
        db=db,
        mission_id=mission_id,
    )

    rows = (
        db.query(
            KnowledgeGap,
            InterviewAnalysis,
        )
        .join(
            InterviewAnalysis,
            KnowledgeGap.analysis_id
            == InterviewAnalysis.analysis_id,
        )
        .filter(
            InterviewAnalysis.mission_id
            == mission_id
        )
        .order_by(
            KnowledgeGap.created_at.desc()
        )
        .all()
    )

    gaps = [
        MissionKnowledgeGapResponse(
            gap_id=gap.gap_id,
            mission_id=analysis.mission_id,
            interview_id=analysis.interview_id,
            analysis_id=analysis.analysis_id,
            topic=gap.topic,
            dimension=gap.dimension,
            gap_type=gap.gap_type,
            gap_score=(
                float(gap.gap_score)
                if gap.gap_score is not None
                else None
            ),
            reason=gap.reason,
            created_at=gap.created_at,
        )
        for gap, analysis in rows
    ]

    return MissionKnowledgeGapListResponse(
        total=len(gaps),
        gaps=gaps,
    )


def get_mission_conflicts(
    db: Session,
    mission_id: uuid.UUID,
) -> MissionKnowledgeConflictListResponse:
    """
    Mission에 속한 모든 Interview에서 생성된
    Knowledge Conflict를 통합 조회한다.

    Detection History는 DB에 그대로 보존한다.

    Mission Conflict 화면에서는:
    - 동일 Conflict 반복 노출 억제
    - atomic Conflict들의 단순 합집합인
      composite Conflict 노출 억제
    - Conflict Source provenance 정규화

    를 적용한다.

    최신 Conflict부터 반환한다.
    """

    _validate_mission(
        db=db,
        mission_id=mission_id,
    )

    rows = (
        db.query(
            KnowledgeConflict,
            InterviewAnalysis,
        )
        .join(
            InterviewAnalysis,
            KnowledgeConflict.analysis_id
            == InterviewAnalysis.analysis_id,
        )
        .filter(
            InterviewAnalysis.mission_id
            == mission_id
        )
        .order_by(
            KnowledgeConflict.created_at.desc()
        )
        .all()
    )

    if not rows:
        return MissionKnowledgeConflictListResponse(
            total=0,
            conflicts=[],
        )

    conflict_ids = [
        conflict.conflict_id
        for conflict, _ in rows
    ]

    source_rows = (
        db.query(ConflictSource)
        .filter(
            ConflictSource.conflict_id.in_(
                conflict_ids
            )
        )
        .order_by(
            ConflictSource.created_at.asc()
        )
        .all()
    )

    analysis_by_conflict_id = {
        conflict.conflict_id: analysis
        for conflict, analysis in rows
    }

    sources_by_conflict: dict[
        uuid.UUID,
        list[MissionConflictSourceResponse],
    ] = defaultdict(list)

    canonical_sources_by_conflict: dict[
        uuid.UUID,
        list[
            tuple[
                str,
                str | None,
                str,
            ]
        ],
    ] = defaultdict(list)

    # -----------------------------------------------------
    # Source provenance normalization
    #
    # 과거 DB에 source_type="Knowledge"로 저장되어 있어도
    # 해당 Analysis의 request_context를 통해
    # BASELINE_CLAIM / KNOWLEDGE_UNIT / EVIDENCE를
    # 재판별한다.
    # -----------------------------------------------------
    for source in source_rows:
        analysis = (
            analysis_by_conflict_id.get(
                source.conflict_id
            )
        )

        request_context = (
            analysis.request_context
            if analysis is not None
            and analysis.request_context
            else {}
        )

        normalized_source_type = (
            resolve_conflict_source_type(
                source_type=(
                    source.source_type
                ),
                source_id=(
                    source.source_id
                ),
                request_context=(
                    request_context
                ),
            )
        )

        sources_by_conflict[
            source.conflict_id
        ].append(
            MissionConflictSourceResponse(
                conflict_source_id=(
                    source.conflict_source_id
                ),
                source_type=(
                    normalized_source_type
                ),
                source_id=source.source_id,
                content=source.content,
                created_at=source.created_at,
            )
        )

        canonical_sources_by_conflict[
            source.conflict_id
        ].append(
            (
                normalized_source_type,
                source.source_id,
                source.content,
            )
        )

    # -----------------------------------------------------
    # Mission Conflict Presentation Canonicalization
    #
    # rows는 이미 최신순이다.
    # DB 삭제 없이 화면에 노출할 Conflict만 결정한다.
    # -----------------------------------------------------
    canonicalization_records = [
        build_conflict_canonicalization_record(
            conflict_id=str(
                conflict.conflict_id
            ),
            interview_id=str(
                analysis.interview_id
            ),
            conflict_type=(
                conflict.conflict_type
            ),
            description=(
                conflict.description
            ),
            sources=(
                canonical_sources_by_conflict.get(
                    conflict.conflict_id,
                    [],
                )
            ),
        )
        for conflict, analysis in rows
    ]

    visible_conflict_ids = (
        select_visible_conflict_ids(
            canonicalization_records
        )
    )

    conflicts = []

    for conflict, analysis in rows:
        if (
            str(conflict.conflict_id)
            not in visible_conflict_ids
        ):
            continue

        conflicts.append(
            MissionKnowledgeConflictResponse(
                conflict_id=(
                    conflict.conflict_id
                ),
                mission_id=(
                    analysis.mission_id
                ),
                interview_id=(
                    analysis.interview_id
                ),
                analysis_id=(
                    analysis.analysis_id
                ),
                conflict_type=(
                    conflict.conflict_type
                ),
                severity=conflict.severity,
                description=(
                    conflict.description
                ),
                context_difference=(
                    conflict.context_difference
                ),
                unknown_condition=(
                    conflict.unknown_condition
                ),
                recommended_question=(
                    conflict.recommended_question
                ),
                sources=(
                    sources_by_conflict.get(
                        conflict.conflict_id,
                        [],
                    )
                ),
                created_at=(
                    conflict.created_at
                ),
            )
        )

    return MissionKnowledgeConflictListResponse(
        total=len(conflicts),
        conflicts=conflicts,
    )