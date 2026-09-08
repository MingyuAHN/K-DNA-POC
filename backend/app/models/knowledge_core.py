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
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class KnowledgeUnit(Base):
    __tablename__ = "knowledge_unit"

    knowledge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    mission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "mission.mission_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    source_candidate_id: Mapped[
        uuid.UUID | None
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_candidate.candidate_id",
            ondelete="SET NULL",
        ),
        nullable=True,
        unique=True,
    )

    source_synthesis_id: Mapped[
        uuid.UUID | None
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_synthesis.synthesis_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    source_synthesis_unit_id: Mapped[
        uuid.UUID | None
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_synthesis_unit.synthesis_unit_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    knowledge_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    statement: Mapped[str] = mapped_column(
        Text,
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

    status: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default="VERIFIED",
    )

    confidence_score: Mapped[
        float | None
    ] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    root_knowledge_id: Mapped[
        uuid.UUID | None
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_unit.knowledge_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    supersedes_id: Mapped[
        uuid.UUID | None
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_unit.knowledge_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    change_reason: Mapped[
        str | None
    ] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Validation(Base):
    __tablename__ = "validation"

    validation_id: Mapped[
        uuid.UUID
    ] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
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

    knowledge_id: Mapped[
        uuid.UUID | None
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_unit.knowledge_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    validation_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    reason: Mapped[
        str | None
    ] = mapped_column(
        Text,
        nullable=True,
    )

    validated_by: Mapped[
        str | None
    ] = mapped_column(
        String(200),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class Evidence(Base):
    __tablename__ = "evidence"

    evidence_id: Mapped[
        uuid.UUID
    ] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    knowledge_id: Mapped[
        uuid.UUID
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_unit.knowledge_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    source_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    source_id: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    source_text: Mapped[
        str | None
    ] = mapped_column(
        Text,
        nullable=True,
    )

    confidence_score: Mapped[
        float | None
    ] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    metadata_: Mapped[
        dict[str, Any]
    ] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class KnowledgeRelation(Base):
    __tablename__ = "knowledge_relation"

    relation_id: Mapped[
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

    from_knowledge_id: Mapped[
        uuid.UUID
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_unit.knowledge_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    to_knowledge_id: Mapped[
        uuid.UUID
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_unit.knowledge_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    relation_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    confidence_score: Mapped[
        float | None
    ] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    source_analysis_id: Mapped[
        uuid.UUID | None
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "interview_analysis.analysis_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )