from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.expert import (
    ExpertCreate,
    ExpertResponse,
)
from app.services.expert_service import (
    create_expert,
)


router = APIRouter(
    prefix="/api/v1/experts",
    tags=["experts"],
)


@router.post(
    "",
    response_model=ExpertResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_expert_api(
    request: ExpertCreate,
    db: Session = Depends(get_db),
):
    return create_expert(
        db=db,
        request=request,
    )