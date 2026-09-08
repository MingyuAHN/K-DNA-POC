import uuid

from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.knowledge_synthesis_apply import (
    KnowledgeSynthesisValidationRequest,
    KnowledgeSynthesisValidationResponse,
)
from app.services.knowledge_synthesis_apply_service import (
    validate_and_apply_synthesis,
)


router = APIRouter(
    prefix="/api/v1",
    tags=["knowledge-synthesis"],
)


@router.post(
    "/knowledge-syntheses/{synthesis_id}/validate",
    response_model=(
        KnowledgeSynthesisValidationResponse
    ),
)
def validate_knowledge_synthesis_api(
    synthesis_id: uuid.UUID,
    request: (
        KnowledgeSynthesisValidationRequest
    ),
    db: Session = Depends(get_db),
):
    return validate_and_apply_synthesis(
        db=db,
        synthesis_id=synthesis_id,
        request=request,
    )