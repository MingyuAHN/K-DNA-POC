import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.knowledge_core import (
    KnowledgeRelation,
    KnowledgeUnit,
)
from app.schemas.knowledge_version import (
    KnowledgeVersionCreate,
    KnowledgeVersionHistoryResponse,
    KnowledgeVersionResponse,
)


def get_knowledge(
    db: Session,
    knowledge_id: uuid.UUID,
) -> KnowledgeUnit | None:

    return (
        db.query(KnowledgeUnit)
        .filter(
            KnowledgeUnit.knowledge_id
            == knowledge_id
        )
        .first()
    )


def to_version_response(
    row: KnowledgeUnit,
) -> KnowledgeVersionResponse:

    return KnowledgeVersionResponse(
        knowledge_id=row.knowledge_id,
        mission_id=row.mission_id,
        knowledge_type=row.knowledge_type,
        statement=row.statement,
        context=row.context or {},
        decision_rule=row.decision_rule,
        rationale=row.rationale,
        exception=row.exception,
        status=row.status,
        confidence_score=(
            float(row.confidence_score)
            if row.confidence_score is not None
            else None
        ),
        version=row.version,
        root_knowledge_id=(
            row.root_knowledge_id
        ),
        supersedes_id=row.supersedes_id,
        change_reason=row.change_reason,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def create_knowledge_version(
    db: Session,
    knowledge_id: uuid.UUID,
    request: KnowledgeVersionCreate,
) -> KnowledgeUnit:

    current = get_knowledge(
        db=db,
        knowledge_id=knowledge_id,
    )

    if current is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge unit not found",
        )

    if current.status == "SUPERSEDED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cannot create a new version from "
                "an already superseded knowledge unit"
            ),
        )

    if current.status == "RETIRED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cannot create a new version from "
                "a retired knowledge unit"
            ),
        )

    # 최초 Knowledge Unit이면 자기 자신이 Root
    root_id = (
        current.root_knowledge_id
        if current.root_knowledge_id is not None
        else current.knowledge_id
    )

    try:
        new_version = KnowledgeUnit(
            mission_id=current.mission_id,

            # Version 2+는 특정 Candidate와 1:1 관계가
            # 아닐 수 있으므로 null 유지
            source_candidate_id=None,

            knowledge_type=current.knowledge_type,

            statement=(
                request.statement
                if request.statement is not None
                else current.statement
            ),

            context=(
                request.context
                if request.context is not None
                else current.context
            ),

            decision_rule=(
                request.decision_rule
                if request.decision_rule is not None
                else current.decision_rule
            ),

            rationale=(
                request.rationale
                if request.rationale is not None
                else current.rationale
            ),

            exception=(
                request.exception
                if request.exception is not None
                else current.exception
            ),

            status="VERIFIED",

            confidence_score=(
                request.confidence_score
                if request.confidence_score is not None
                else current.confidence_score
            ),

            version=current.version + 1,

            root_knowledge_id=root_id,

            supersedes_id=current.knowledge_id,

            change_reason=request.change_reason,
        )

        db.add(new_version)
        db.flush()

        # 기존 Knowledge는 더 이상 최신 버전이 아님
        current.status = "SUPERSEDED"

        # Graph에도 Version 관계 기록
        relation = KnowledgeRelation(
            mission_id=current.mission_id,

            # 새 버전이 기존 버전을 대체
            from_knowledge_id=(
                new_version.knowledge_id
            ),

            to_knowledge_id=(
                current.knowledge_id
            ),

            relation_type="SUPERSEDES",

            confidence_score=1.0,

            source_analysis_id=None,
        )

        db.add(relation)

        db.commit()

        db.refresh(current)
        db.refresh(new_version)

        return new_version

    except HTTPException:
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Knowledge version creation failed: "
                f"{str(exc)}"
            ),
        )


def get_version_history(
    db: Session,
    knowledge_id: uuid.UUID,
) -> KnowledgeVersionHistoryResponse:

    knowledge = get_knowledge(
        db=db,
        knowledge_id=knowledge_id,
    )

    if knowledge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge unit not found",
        )

    root_id = (
        knowledge.root_knowledge_id
        if knowledge.root_knowledge_id is not None
        else knowledge.knowledge_id
    )

    rows = (
        db.query(KnowledgeUnit)
        .filter(
            KnowledgeUnit.mission_id
            == knowledge.mission_id
        )
        .filter(
            (
                KnowledgeUnit.knowledge_id
                == root_id
            )
            |
            (
                KnowledgeUnit.root_knowledge_id
                == root_id
            )
        )
        .order_by(
            KnowledgeUnit.version.asc()
        )
        .all()
    )

    return KnowledgeVersionHistoryResponse(
        root_knowledge_id=root_id,
        versions=[
            to_version_response(row)
            for row in rows
        ],
    )