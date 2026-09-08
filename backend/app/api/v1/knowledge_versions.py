import uuid

from fastapi import (
    APIRouter,
    Depends,
    status,
)
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.knowledge_version import (
    KnowledgeVersionCreate,
    KnowledgeVersionHistoryResponse,
    KnowledgeVersionResponse,
)
from app.services.knowledge_version_service import (
    create_knowledge_version,
    get_version_history,
    to_version_response,
)


router = APIRouter(
    prefix="/api/v1",
    tags=["knowledge-version"],
)


@router.post(
    "/knowledge-units/{knowledge_id}/versions",
    response_model=KnowledgeVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_knowledge_version_api(
    knowledge_id: uuid.UUID,
    request: KnowledgeVersionCreate,
    db: Session = Depends(get_db),
):
    knowledge = create_knowledge_version(
        db=db,
        knowledge_id=knowledge_id,
        request=request,
    )

    return to_version_response(
        knowledge
    )


@router.get(
    "/knowledge-units/{knowledge_id}/versions",
    response_model=KnowledgeVersionHistoryResponse,
)
def get_knowledge_version_history_api(
    knowledge_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    return get_version_history(
        db=db,
        knowledge_id=knowledge_id,
    )