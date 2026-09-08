import uuid

from fastapi import (
    HTTPException,
    status,
)
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.expert import Expert
from app.schemas.expert import (
    ExpertCreate,
)


def create_expert(
    db: Session,
    request: ExpertCreate,
) -> Expert:

    expert = Expert(
        name=request.name.strip(),
        organization=(
            request.organization.strip()
            if request.organization
            else None
        ),
        role=(
            request.role.strip()
            if request.role
            else None
        ),
        metadata_=request.metadata,
    )

    try:
        db.add(expert)
        db.commit()
        db.refresh(expert)

        return expert

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Expert creation failed: "
                f"{str(exc)}"
            ),
        )


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


def get_experts(
    db: Session,
    query: str | None = None,
    limit: int = 100,
) -> list[Expert]:

    db_query = db.query(Expert)

    if query is not None:
        keyword = query.strip()

        if keyword:
            search = f"%{keyword}%"

            db_query = db_query.filter(
                or_(
                    Expert.name.ilike(search),
                    Expert.organization.ilike(
                        search
                    ),
                    Expert.role.ilike(search),
                )
            )

    return (
        db_query
        .order_by(
            Expert.created_at.desc()
        )
        .limit(limit)
        .all()
    )