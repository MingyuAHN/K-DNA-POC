import uuid

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.expert import (
    ExpertCreate,
    ExpertListResponse,
    ExpertResponse,
)
from app.services.expert_service import (
    create_expert,
    get_expert,
    get_experts,
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


@router.get(
    "",
    response_model=ExpertListResponse,
)
def get_experts_api(
    query: str | None = Query(
        default=None,
        description=(
            "Search by name, organization, "
            "or role"
        ),
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=200,
    ),
    db: Session = Depends(get_db),
):
    experts = get_experts(
        db=db,
        query=query,
        limit=limit,
    )

    return ExpertListResponse(
        total=len(experts),
        experts=experts,
    )


@router.get(
    "/{expert_id}",
    response_model=ExpertResponse,
)
def get_expert_api(
    expert_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    expert = get_expert(
        db=db,
        expert_id=expert_id,
    )

    if expert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expert not found",
        )

    return expert