import uuid
from typing import Any

from pydantic import (
    BaseModel,
    Field,
    field_validator,
)


class KnowledgeContext(BaseModel):
    project: str | None = None
    phase: str | None = None
    domain: str | None = None
    system: str | None = None
    scope: str | None = None
    time: str | None = None

    constraints: list[str] = Field(
        default_factory=list
    )

    tags: list[str] = Field(
        default_factory=list
    )

    @field_validator(
        "constraints",
        "tags",
        mode="before",
    )
    @classmethod
    def normalize_list_fields(
        cls,
        value: Any,
    ) -> list:
        if value is None:
            return []

        return value


class DecisionRule(BaseModel):
    if_conditions: list[str] = Field(
        default_factory=list
    )

    then: str

    unless: list[str] = Field(
        default_factory=list
    )

    @field_validator(
        "if_conditions",
        "unless",
        mode="before",
    )
    @classmethod
    def normalize_list_fields(
        cls,
        value: Any,
    ) -> list:
        if value is None:
            return []

        return value


class KnowledgeCandidateItem(BaseModel):
    statement: str

    type: str

    context: KnowledgeContext

    decision_rule: DecisionRule | None = None

    rationale: str | None = None
    exception: str | None = None

    novelty_score: float = Field(
        ...,
        ge=0,
        le=1,
    )

    confidence_score: float = Field(
        ...,
        ge=0,
        le=1,
    )

    validation_status: str

    @field_validator(
        "decision_rule",
        mode="before",
    )
    @classmethod
    def normalize_decision_rule(
        cls,
        value: Any,
    ) -> Any:
        """
        AI가 불완전한 decision_rule을 반환하더라도
        Interview 전체가 실패하지 않도록 방어한다.

        정상:
        {
            "if_conditions": [...],
            "then": "...",
            "unless": [...]
        }

        비정상:
        {
            "if_conditions": [...],
            "then": null,
            "unless": [...]
        }

        위와 같이 then이 없거나 null/빈 문자열이면
        decision_rule 자체를 None으로 처리한다.

        DecisionRule 모델의 then: str 제약은 그대로
        유지하므로 정상 데이터의 Contract는 느슨해지지 않는다.
        """

        if value is None:
            return None

        if not isinstance(value, dict):
            return value

        then_value = value.get(
            "then"
        )

        if (
            not isinstance(
                then_value,
                str,
            )
            or not then_value.strip()
        ):
            return None

        normalized = dict(value)

        if normalized.get(
            "if_conditions"
        ) is None:
            normalized[
                "if_conditions"
            ] = []

        if normalized.get(
            "unless"
        ) is None:
            normalized[
                "unless"
            ] = []

        return normalized


class KnowledgeGapItem(BaseModel):
    topic: str
    dimension: str
    gap_type: str

    gap_score: float = Field(
        ...,
        ge=0,
        le=1,
    )

    reason: str


class ConflictSourceItem(BaseModel):
    source_type: str
    source_id: str | None = None
    content: str


class KnowledgeConflictItem(BaseModel):
    conflict_type: str
    severity: str
    description: str

    sources: list[
        ConflictSourceItem
    ] = Field(
        default_factory=list
    )

    context_difference: str | None = None

    unknown_condition: str | None = None

    recommended_question: str | None = None

    @field_validator(
        "sources",
        mode="before",
    )
    @classmethod
    def normalize_sources(
        cls,
        value: Any,
    ) -> list:
        if value is None:
            return []

        return value


class QuestionCandidateItem(BaseModel):
    question: str
    question_type: str

    target_gap: str | None = None

    gap_reduction_score: float = Field(
        ...,
        ge=0,
        le=1,
    )

    novelty_score: float = Field(
        ...,
        ge=0,
        le=1,
    )

    business_impact_score: float = Field(
        ...,
        ge=0,
        le=1,
    )

    conflict_resolution_score: float = Field(
        ...,
        ge=0,
        le=1,
    )

    redundancy_score: float = Field(
        ...,
        ge=0,
        le=1,
    )

    value_score: float = Field(
        ...,
        ge=0,
        le=1,
    )


class InterviewOrchestrationResponse(BaseModel):
    knowledge_candidates: list[
        KnowledgeCandidateItem
    ] = Field(default_factory=list)

    gaps: list[
        KnowledgeGapItem
    ] = Field(default_factory=list)

    conflicts: list[
        KnowledgeConflictItem
    ] = Field(default_factory=list)

    question_candidates: list[
        QuestionCandidateItem
    ] = Field(default_factory=list)

    next_question: (
        QuestionCandidateItem | None
    ) = None

    @field_validator(
        "knowledge_candidates",
        "gaps",
        "conflicts",
        "question_candidates",
        mode="before",
    )
    @classmethod
    def normalize_response_lists(
        cls,
        value: Any,
    ) -> list:
        if value is None:
            return []

        return value


class InterviewTurnRequest(BaseModel):
    content: str = Field(
        ...,
        min_length=1,
    )

    knowledge_top_k: int = Field(
        default=5,
        ge=1,
        le=20,
    )

    evidence_top_k: int = Field(
        default=3,
        ge=1,
        le=20,
    )

    history_limit: int = Field(
        default=20,
        ge=1,
        le=100,
    )


class InterviewTurnResponse(BaseModel):
    analysis_id: uuid.UUID

    interview_id: uuid.UUID

    user_message_id: uuid.UUID

    assistant_message_id: (
        uuid.UUID | None
    ) = None

    user_message: str

    knowledge_candidates: list[
        KnowledgeCandidateItem
    ]

    gaps: list[
        KnowledgeGapItem
    ]

    conflicts: list[
        KnowledgeConflictItem
    ]

    question_candidates: list[
        QuestionCandidateItem
    ]

    next_question: (
        QuestionCandidateItem | None
    ) = None