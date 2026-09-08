import uuid

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.knowledge_core import (
    KnowledgeRelation,
    KnowledgeUnit,
)
from app.schemas.knowledge_graph import (
    KnowledgeGraphEdge,
    KnowledgeGraphNode,
    KnowledgeGraphResponse,
    KnowledgeRelationCreate,
)
from app.services.mission_service import get_mission


def get_knowledge_unit(
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


def create_knowledge_relation(
    db: Session,
    request: KnowledgeRelationCreate,
) -> KnowledgeRelation:

    if (
        request.from_knowledge_id
        == request.to_knowledge_id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A knowledge unit cannot have "
                "a relation to itself"
            ),
        )

    from_knowledge = get_knowledge_unit(
        db=db,
        knowledge_id=request.from_knowledge_id,
    )

    if from_knowledge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source knowledge unit not found",
        )

    to_knowledge = get_knowledge_unit(
        db=db,
        knowledge_id=request.to_knowledge_id,
    )

    if to_knowledge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target knowledge unit not found",
        )

    # 서로 다른 Mission의 Knowledge는
    # 동일 K-DNA Graph 관계로 연결하지 않음
    if (
        from_knowledge.mission_id
        != to_knowledge.mission_id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Knowledge units must belong "
                "to the same mission"
            ),
        )

    existing = (
        db.query(KnowledgeRelation)
        .filter(
            KnowledgeRelation.from_knowledge_id
            == request.from_knowledge_id,
            KnowledgeRelation.to_knowledge_id
            == request.to_knowledge_id,
            KnowledgeRelation.relation_type
            == request.relation_type,
        )
        .first()
    )

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Knowledge relation already exists",
        )

    relation = KnowledgeRelation(
        mission_id=from_knowledge.mission_id,
        from_knowledge_id=(
            request.from_knowledge_id
        ),
        to_knowledge_id=(
            request.to_knowledge_id
        ),
        relation_type=request.relation_type,
        confidence_score=(
            request.confidence_score
        ),
        source_analysis_id=(
            request.source_analysis_id
        ),
    )

    try:
        db.add(relation)
        db.commit()
        db.refresh(relation)

        return relation

    except IntegrityError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Knowledge relation could not "
                "be created due to a conflict"
            ),
        ) from exc

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Knowledge relation creation failed: "
                f"{str(exc)}"
            ),
        )


def get_mission_knowledge_relations(
    db: Session,
    mission_id: uuid.UUID,
) -> list[KnowledgeRelation]:

    mission = get_mission(
        db=db,
        mission_id=mission_id,
    )

    if mission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )

    return (
        db.query(KnowledgeRelation)
        .filter(
            KnowledgeRelation.mission_id
            == mission_id
        )
        .order_by(
            KnowledgeRelation.created_at.asc()
        )
        .all()
    )


def build_knowledge_graph(
    db: Session,
    mission_id: uuid.UUID,
) -> KnowledgeGraphResponse:

    mission = get_mission(
        db=db,
        mission_id=mission_id,
    )

    if mission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )

    knowledge_units = (
        db.query(KnowledgeUnit)
        .filter(
            KnowledgeUnit.mission_id
            == mission_id
        )
        .order_by(
            KnowledgeUnit.created_at.asc()
        )
        .all()
    )

    relations = (
        db.query(KnowledgeRelation)
        .filter(
            KnowledgeRelation.mission_id
            == mission_id
        )
        .order_by(
            KnowledgeRelation.created_at.asc()
        )
        .all()
    )

    nodes = [
        KnowledgeGraphNode(
            knowledge_id=row.knowledge_id,
            knowledge_type=row.knowledge_type,
            statement=row.statement,
            context=row.context,
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
            supersedes_id=(
                row.supersedes_id
            ),
        )
        for row in knowledge_units
    ]

    edges = [
        KnowledgeGraphEdge(
            relation_id=row.relation_id,
            source=row.from_knowledge_id,
            target=row.to_knowledge_id,
            relation_type=row.relation_type,
            confidence_score=(
                float(row.confidence_score)
                if row.confidence_score is not None
                else None
            ),
            source_analysis_id=(
                row.source_analysis_id
            ),
        )
        for row in relations
    ]

    return KnowledgeGraphResponse(
        mission_id=mission_id,
        node_count=len(nodes),
        edge_count=len(edges),
        nodes=nodes,
        edges=edges,
    )