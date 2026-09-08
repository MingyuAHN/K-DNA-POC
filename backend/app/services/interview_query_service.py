import uuid

from fastapi import (
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.models.interview import Interview
from app.models.mission import Mission


def get_mission_interviews(
    db: Session,
    mission_id: uuid.UUID,
) -> list[Interview]:

    mission = (
        db.query(Mission)
        .filter(
            Mission.mission_id
            == mission_id
        )
        .first()
    )

    if mission is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Mission not found",
        )

    return (
        db.query(Interview)
        .filter(
            Interview.mission_id
            == mission_id
        )
        .order_by(
            Interview.created_at.desc()
        )
        .all()
    )