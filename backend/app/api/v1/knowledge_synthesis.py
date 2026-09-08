import uuid

from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.knowledge_synthesis import (
    KnowledgeSynthesisRequest,
    KnowledgeSynthesisResponse,
)
from app.services.knowledge_synthesis_service import (
    synthesize_candidate,
)


router = APIRouter(
    prefix="/api/v1",
    tags=["knowledge-synthesis"],
)


@router.post(
    "/knowledge-candidates/{candidate_id}/synthesize",
    response_model=KnowledgeSynthesisResponse,
)
def synthesize_knowledge_candidate_api(
    candidate_id: uuid.UUID,
    request: KnowledgeSynthesisRequest,
    db: Session = Depends(get_db),
):
    return synthesize_candidate(
        db=db,
        candidate_id=candidate_id,
        request=request,
    )