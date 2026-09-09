import uuid

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.mission import (
    MissionCreate,
    MissionListResponse,
    MissionResponse,
)
from app.services.mission_service import (
    create_mission,
    get_mission,
    get_missions,
)


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
    return create_mission(
        db=db,
        request=request,
    )


@router.get(
    "",
    response_model=MissionListResponse,
)
def get_missions_api(
    db: Session = Depends(get_db),
):
    missions = get_missions(
        db=db,
    )

    return MissionListResponse(
        total=len(missions),
        missions=missions,
    )


@router.get(
    "/{mission_id}",
    response_model=MissionResponse,
)
def get_mission_api(
    mission_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    mission = get_mission(
        db=db,
        mission_id=mission_id,
    )

    if mission is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Mission not found",
        )

    return mission