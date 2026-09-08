import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.mission import MissionCreate, MissionResponse
from app.services.mission_service import create_mission, get_mission


router = APIRouter(
    prefix="/api/v1/missions",
    tags=["missions"],
)


@router.post(
    "",
    response_model=MissionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_mission_api(
    request: MissionCreate,
    db: Session = Depends(get_db),
):
    return create_mission(db, request)


@router.get(
    "/{mission_id}",
    response_model=MissionResponse,
)
def get_mission_api(
    mission_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    mission = get_mission(db, mission_id)

    if mission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )

    return mission