import uuid

from sqlalchemy.orm import Session

from app.models.expert import Expert
from app.schemas.expert import ExpertCreate


def create_expert(
    db: Session,
    request: ExpertCreate,
) -> Expert:

    expert = Expert(
        name=request.name,
        organization=request.organization,
        role=request.role,
    )

    db.add(expert)
    db.commit()
    db.refresh(expert)

    return expert


def get_expert(
    db: Session,
    expert_id: uuid.UUID,
) -> Expert | None:

    return (
        db.query(Expert)
        .filter(
            Expert.expert_id == expert_id
        )
        .first()
    )