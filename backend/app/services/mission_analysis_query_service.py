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

    Conflict Source도 함께 반환한다.

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

    sources_by_conflict: dict[
        uuid.UUID,
        list[MissionConflictSourceResponse],
    ] = defaultdict(list)

    for source in source_rows:
        sources_by_conflict[
            source.conflict_id
        ].append(
            MissionConflictSourceResponse(
                conflict_source_id=(
                    source.conflict_source_id
                ),
                source_type=source.source_type,
                source_id=source.source_id,
                content=source.content,
                created_at=source.created_at,
            )
        )

    conflicts = []

    for conflict, analysis in rows:
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