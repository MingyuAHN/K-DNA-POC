import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class InterviewAnalysis(Base):
    __tablename__ = "interview_analysis"

    analysis_id: Mapped[uuid.UUID] = mapped_column(
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

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "interview.interview_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    source_message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "interview_message.message_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
    )

    assistant_message_id: Mapped[
        uuid.UUID | None
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "interview_message.message_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    request_context: Mapped[
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

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class KnowledgeCandidate(Base):
    __tablename__ = "knowledge_candidate"

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "interview_analysis.analysis_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    statement: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    knowledge_type: Mapped[str] = mapped_column(
        String(40),
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

    rationale: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    exception: Mapped[str | None] = mapped_column(
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

    validation_status: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default="CANDIDATE",
    )

    review_status: Mapped[str | None] = mapped_column(
        String(40),
        nullable=True,
    )

    review_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    review_synthesis_id: Mapped[
        uuid.UUID | None
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_synthesis.synthesis_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class KnowledgeGap(Base):
    __tablename__ = "knowledge_gap"

    gap_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "interview_analysis.analysis_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    topic: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    dimension: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    gap_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    gap_score: Mapped[
        float | None
    ] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class KnowledgeConflict(Base):
    __tablename__ = "knowledge_conflict"

    conflict_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "interview_analysis.analysis_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    conflict_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    severity: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    context_difference: Mapped[
        str | None
    ] = mapped_column(
        Text,
        nullable=True,
    )

    unknown_condition: Mapped[
        str | None
    ] = mapped_column(
        Text,
        nullable=True,
    )

    recommended_question: Mapped[
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


class ConflictSource(Base):
    __tablename__ = "conflict_source"

    conflict_source_id: Mapped[
        uuid.UUID
    ] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    conflict_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_conflict.conflict_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    source_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    source_id: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class QuestionCandidate(Base):
    __tablename__ = "question_candidate"

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "interview_analysis.analysis_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    assistant_message_id: Mapped[
        uuid.UUID | None
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "interview_message.message_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    question: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    question_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    target_gap: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    gap_reduction_score: Mapped[
        float | None
    ] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    novelty_score: Mapped[
        float | None
    ] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    business_impact_score: Mapped[
        float | None
    ] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    conflict_resolution_score: Mapped[
        float | None
    ] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    redundancy_score: Mapped[
        float | None
    ] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    value_score: Mapped[
        float | None
    ] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    is_selected: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )