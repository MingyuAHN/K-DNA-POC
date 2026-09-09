import uuid

from sqlalchemy.orm import Session

from app.models.mission import Mission
from app.schemas.mission import MissionCreate


def create_mission(
    db: Session,
    request: MissionCreate,
) -> Mission:

    mission = Mission(
        title=request.title,
        domain=request.domain,
        objective=request.objective,
    )

    db.add(mission)
    db.commit()
    db.refresh(mission)

    return mission


def get_missions(
    db: Session,
) -> list[Mission]:
    """
    전체 Mission 목록 조회.

    최신 생성 Mission이 위에 오도록
    created_at DESC 기준으로 정렬한다.
    """

    return (
        db.query(Mission)
        .order_by(
            Mission.created_at.desc()
        )
        .all()
    )


def get_mission(
    db: Session,
    mission_id: uuid.UUID,
) -> Mission | None:

    return (
        db.query(Mission)
        .filter(
            Mission.mission_id
            == mission_id
        )
        .first()
    )