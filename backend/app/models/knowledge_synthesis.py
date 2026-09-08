import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import (
    JSONB,
    UUID,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
)

from app.db.base import Base


class KnowledgeSynthesis(Base):
    __tablename__ = "knowledge_synthesis"

    synthesis_id: Mapped[
        uuid.UUID
    ] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    mission_id: Mapped[
        uuid.UUID
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "mission.mission_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    candidate_id: Mapped[
        uuid.UUID
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_candidate.candidate_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    operation: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    target_knowledge_ids: Mapped[
        list[Any]
    ] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
    )

    reason: Mapped[
        str | None
    ] = mapped_column(
        Text,
        nullable=True,
    )

    request_payload: Mapped[
        dict[str, Any]
    ] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    raw_response: Mapped[
        dict[str, Any]
    ] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING",
    )

    validated_by: Mapped[
        str | None
    ] = mapped_column(
        String(200),
        nullable=True,
    )

    validation_reason: Mapped[
        str | None
    ] = mapped_column(
        Text,
        nullable=True,
    )

    validated_at: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    applied_at: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    resulting_knowledge_ids: Mapped[
        list[Any]
    ] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
    )

    created_at: Mapped[
        datetime
    ] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class KnowledgeSynthesisUnit(Base):
    __tablename__ = (
        "knowledge_synthesis_unit"
    )

    synthesis_unit_id: Mapped[
        uuid.UUID
    ] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    synthesis_id: Mapped[
        uuid.UUID
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_synthesis.synthesis_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    synthesized_index: Mapped[
        int
    ] = mapped_column(
        Integer,
        nullable=False,
    )

    statement: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    knowledge_type: Mapped[
        str
    ] = mapped_column(
        String(50),
        nullable=False,
    )

    context: Mapped[
        dict[str, Any]
    ] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    decision_rule: Mapped[
        dict[str, Any] | None
    ] = mapped_column(
        JSONB,
        nullable=True,
    )

    rationale: Mapped[
        str | None
    ] = mapped_column(
        Text,
        nullable=True,
    )

    exception: Mapped[
        str | None
    ] = mapped_column(
        Text,
        nullable=True,
    )

    novelty_score: Mapped[
        float | None
    ] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    confidence_score: Mapped[
        float | None
    ] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    validation_status: Mapped[
        str
    ] = mapped_column(
        String(40),
        nullable=False,
        default="CANDIDATE",
    )

    applied_knowledge_id: Mapped[
        uuid.UUID | None
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_unit.knowledge_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    created_at: Mapped[
        datetime
    ] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class KnowledgeSynthesisRelation(Base):
    __tablename__ = (
        "knowledge_synthesis_relation"
    )

    synthesis_relation_id: Mapped[
        uuid.UUID
    ] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    synthesis_id: Mapped[
        uuid.UUID
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_synthesis.synthesis_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    synthesized_index: Mapped[
        int
    ] = mapped_column(
        Integer,
        nullable=False,
    )

    target_knowledge_id: Mapped[
        uuid.UUID
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_unit.knowledge_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    relation_type: Mapped[
        str
    ] = mapped_column(
        String(50),
        nullable=False,
    )

    reason: Mapped[
        str | None
    ] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[
        datetime
    ] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )