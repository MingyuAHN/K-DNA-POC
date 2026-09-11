from typing import List, Optional, Literal
from uuid import UUID
from pydantic import BaseModel, Field
from pydantic import BaseModel, ConfigDict, Field, model_validator
from .common import ContextTags
from .enums import (
    KnowledgeType,
    GapDimension,
    GapType,
    ConflictType,
    ConflictSeverity,
    ValidationStatus,
    QuestionType,
    RelationType,
    RelationTargetType,
)


class MissionContext(BaseModel):
    mission_id: str
    domain: str
    objective: str
    focus_topics: List[str] = Field(default_factory=list)


class InterviewContext(BaseModel):
    interview_id: str
    expert_id: Optional[str] = None


class ConversationMessage(BaseModel):
    speaker: str
    content: str


BaselineRetrievedClaimType = Literal[
    "PRINCIPLE",
    "DECISION",
    "EXCEPTION",
    "OUTCOME",
]


class RetrievedKnowledge(BaseModel):
    model_config = ConfigDict(
        extra="forbid"
    )

    claim_id: UUID
    claim_type: BaselineRetrievedClaimType
    statement: str

    similarity: float

    source_chunk_id: UUID
    document_id: UUID
    file_name: str

    page: Optional[int] = None
    section: Optional[str] = None

    context: ContextTags = Field(
        default_factory=ContextTags
    )


class RetrievedEvidence(BaseModel):
    model_config = ConfigDict(
        extra="forbid"
    )

    chunk_id: UUID
    content: str

    similarity: float

    document_id: UUID
    file_name: str

    page: Optional[int] = None
    section: Optional[str] = None

    context: ContextTags = Field(
        default_factory=ContextTags
    )

class RetrievedKnowledgeUnit(BaseModel):
    model_config = ConfigDict(
        extra="forbid"
    )

    knowledge_id: UUID
    knowledge_type: KnowledgeType
    statement: str

    context: ContextTags = Field(
        default_factory=ContextTags
    )

    validation_status: Literal["VERIFIED"]

    version: int = Field(
        ge=1
    )

    confidence_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
    )

    similarity: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
    )

    decision_rule: Optional[dict] = None
    rationale: Optional[str] = None
    exception: Optional[str] = None


# backend가 ai orchestrator에게 넘길 최상위 input 
class InterviewAnalysisRequest(BaseModel):
    mission: MissionContext
    interview: InterviewContext

    message: ConversationMessage

    conversation_context: List[ConversationMessage] = Field(
        default_factory=list
    )

    retrieved_knowledge: List[RetrievedKnowledge] = Field(
        default_factory=list
    )

    retrieved_evidence: List[RetrievedEvidence] = Field(
        default_factory=list
    )

    retrieved_knowledge_units: List[
        RetrievedKnowledgeUnit
    ] = Field(
        default_factory=list
    )

#AI Response Schema 
class DecisionRule(BaseModel):
    if_conditions: List[str] = Field(default_factory=list)
    then: Optional[str] = None
    unless: List[str] = Field(default_factory=list)


class KnowledgeCandidate(BaseModel):
    # 기존 필드들 그대로
    statement: str
    type: KnowledgeType
    context: ContextTags
    decision_rule: DecisionRule | None = None
    rationale: str | None = None
    exception: str | None = None
    novelty_score: float
    confidence_score: float
    validation_status: ValidationStatus

    @model_validator(mode="after")
    def normalize_decision_rule(self):
        if self.decision_rule is not None:
            then_value = self.decision_rule.then

            if (
                then_value is None
                or not str(then_value).strip()
            ):
                self.decision_rule = None

        return self


# Knowledge Extractor 전용 Response
class KnowledgeExtractionResponse(BaseModel):
    knowledge_candidates: List[KnowledgeCandidate] = Field(
        default_factory=list
    )


# Semantic Alignment
class SemanticRelation(BaseModel):
    target_type: RelationTargetType
    target_id: str

    relation: RelationType

    reason: str

    context_difference: Optional[str] = None


class SemanticAlignmentRequest(BaseModel):
    candidate: KnowledgeCandidate

    retrieved_knowledge: List[RetrievedKnowledge] = Field(
        default_factory=list
    )

    retrieved_evidence: List[RetrievedEvidence] = Field(
        default_factory=list
    )

    retrieved_knowledge_units: List[
        RetrievedKnowledgeUnit
    ] = Field(
        default_factory=list
    )

class SemanticAlignmentResponse(BaseModel):
    relations: List[SemanticRelation] = Field(
        default_factory=list
    )


#Gap
class KnowledgeGap(BaseModel):
    topic: str
    dimension: GapDimension
    gap_type: GapType
    gap_score: float = Field(ge=0, le=1)
    reason: str


# Gap Analyzer 전용 Request
class GapAnalysisRequest(BaseModel):
    candidate: KnowledgeCandidate
    mission: MissionContext

    conversation_context: List[ConversationMessage] = Field(
        default_factory=list
    )

    retrieved_knowledge: List[RetrievedKnowledge] = Field(
        default_factory=list
    )

    retrieved_knowledge_units: List[
        RetrievedKnowledgeUnit
    ] = Field(
        default_factory=list
    )

    retrieved_evidence: List[RetrievedEvidence] = Field(
        default_factory=list
    )

# Gap Analyzer 전용 Response
class GapAnalysisResponse(BaseModel):
    gaps: List[KnowledgeGap] = Field(
        default_factory=list
    )


#Conflict
class ConflictSource(BaseModel):
    source_type: str
    source_id: str
    content: str


class ConflictResult(BaseModel):
    conflict_type: ConflictType
    severity: ConflictSeverity
    description: str

    sources: List[ConflictSource] = Field(default_factory=list)

    context_difference: Optional[str] = None
    unknown_condition: Optional[str] = None
    recommended_question: Optional[str] = None


# Conflict Detector 전용 Request
class ConflictAnalysisRequest(BaseModel):
    candidate: KnowledgeCandidate
    mission: MissionContext

    semantic_relations: List[SemanticRelation] = Field(
        default_factory=list
    )

    retrieved_knowledge: List[RetrievedKnowledge] = Field(
        default_factory=list
    )

    retrieved_evidence: List[RetrievedEvidence] = Field(
        default_factory=list
    )

    retrieved_knowledge_units: List[
        RetrievedKnowledgeUnit
    ] = Field(
        default_factory=list
    )

# Conflict Detector 전용 Response
class ConflictAnalysisResponse(BaseModel):
    conflicts: List[ConflictResult] = Field(
        default_factory=list
    )


#Question Candidate Schema
class QuestionCandidate(BaseModel):
    question: str
    question_type: QuestionType

    target_gap: Optional[str] = None

    gap_reduction_score: float = Field(ge=0, le=1)
    novelty_score: float = Field(ge=0, le=1)
    business_impact_score: float = Field(ge=0, le=1)
    conflict_resolution_score: float = Field(ge=0, le=1)
    redundancy_score: float = Field(ge=0, le=1)

    value_score: float = Field(ge=0, le=1)


class QuestionPlanningRequest(BaseModel):
    candidate: KnowledgeCandidate
    mission: MissionContext

    gaps: List[KnowledgeGap] = Field(
        default_factory=list
    )

    conflicts: List[ConflictResult] = Field(
        default_factory=list
    )

    conversation_context: List[ConversationMessage] = Field(
        default_factory=list
    )


class QuestionPlanningResponse(BaseModel):
    question_candidates: List[QuestionCandidate] = Field(
        default_factory=list
    )

    next_question: Optional[QuestionCandidate] = None


#최종 Response
class InterviewAnalysisResponse(BaseModel):
    knowledge_candidates: List[KnowledgeCandidate] = Field(
        default_factory=list
    )

    gaps: List[KnowledgeGap] = Field(
        default_factory=list
    )

    conflicts: List[ConflictResult] = Field(
        default_factory=list
    )

    question_candidates: List[QuestionCandidate] = Field(
        default_factory=list
    )

    next_question: Optional[QuestionCandidate] = None