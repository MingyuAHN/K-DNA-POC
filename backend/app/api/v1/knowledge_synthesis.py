import uuid

from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.knowledge_synthesis import (
    AutoKnowledgeSyncResponse,
    KnowledgeSynthesisRequest,
    KnowledgeSynthesisResponse,
)
from app.services.auto_knowledge_sync_service import (
    sync_analysis_to_knowledge,
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


@router.post(
    "/interview-analyses/{analysis_id}/knowledge/sync",
    response_model=AutoKnowledgeSyncResponse,
)
def sync_interview_analysis_knowledge_api(
    analysis_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    return sync_analysis_to_knowledge(
        db=db,
        analysis_id=analysis_id,
    )