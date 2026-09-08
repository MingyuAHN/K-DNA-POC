import uuid

from fastapi import (
    APIRouter,
    Depends,
    status,
)
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.knowledge_graph import (
    KnowledgeGraphResponse,
    KnowledgeRelationCreate,
    KnowledgeRelationResponse,
)
from app.services.knowledge_graph_service import (
    build_knowledge_graph,
    create_knowledge_relation,
    get_mission_knowledge_relations,
)


router = APIRouter(
    prefix="/api/v1",
    tags=["knowledge-graph"],
)


@router.post(
    "/knowledge-relations",
    response_model=KnowledgeRelationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_knowledge_relation_api(
    request: KnowledgeRelationCreate,
    db: Session = Depends(get_db),
):
    relation = create_knowledge_relation(
        db=db,
        request=request,
    )

    return KnowledgeRelationResponse(
        relation_id=relation.relation_id,
        mission_id=relation.mission_id,
        from_knowledge_id=(
            relation.from_knowledge_id
        ),
        to_knowledge_id=(
            relation.to_knowledge_id
        ),
        relation_type=relation.relation_type,
        confidence_score=(
            float(relation.confidence_score)
            if relation.confidence_score
            is not None
            else None
        ),
        source_analysis_id=(
            relation.source_analysis_id
        ),
        created_at=relation.created_at,
    )


@router.get(
    "/missions/{mission_id}/knowledge-relations",
    response_model=list[
        KnowledgeRelationResponse
    ],
)
def get_knowledge_relations_api(
    mission_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    relations = (
        get_mission_knowledge_relations(
            db=db,
            mission_id=mission_id,
        )
    )

    return [
        KnowledgeRelationResponse(
            relation_id=row.relation_id,
            mission_id=row.mission_id,
            from_knowledge_id=(
                row.from_knowledge_id
            ),
            to_knowledge_id=(
                row.to_knowledge_id
            ),
            relation_type=row.relation_type,
            confidence_score=(
                float(row.confidence_score)
                if row.confidence_score
                is not None
                else None
            ),
            source_analysis_id=(
                row.source_analysis_id
            ),
            created_at=row.created_at,
        )
        for row in relations
    ]


@router.get(
    "/missions/{mission_id}/knowledge-graph",
    response_model=KnowledgeGraphResponse,
)
def get_knowledge_graph_api(
    mission_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    return build_knowledge_graph(
        db=db,
        mission_id=mission_id,
    )