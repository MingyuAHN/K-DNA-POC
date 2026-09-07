from typing import List, Optional
from pydantic import BaseModel, Field

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


class RetrievedKnowledge(BaseModel):
    knowledge_id: str
    statement: str
    type: KnowledgeType
    context: ContextTags
    confidence_score: Optional[float] = None


class RetrievedEvidence(BaseModel):
    source_chunk_id: str
    source: str
    content: str
    context: ContextTags
    relevance_score: Optional[float] = None


# backend가 ai orchestrator에게 넘길 최상위 input 
class InterviewAnalysisRequest(BaseModel):
    mission: MissionContext
    interview: InterviewContext

    conversation_context: List[ConversationMessage] = Field(
        default_factory=list
    )

    expert_answer: str

    retrieved_knowledge: List[RetrievedKnowledge] = Field(
        default_factory=list
    )

    retrieved_evidence: List[RetrievedEvidence] = Field(
        default_factory=list
    )


#AI Response Schema 
class DecisionRule(BaseModel):
    if_conditions: List[str] = Field(default_factory=list)
    then: Optional[str] = None
    unless: List[str] = Field(default_factory=list)


class KnowledgeCandidate(BaseModel):
    statement: str
    type: KnowledgeType

    context: ContextTags

    decision_rule: Optional[DecisionRule] = None
    rationale: Optional[str] = None
    exception: Optional[str] = None

    novelty_score: float = Field(ge=0, le=1)
    confidence_score: float = Field(ge=0, le=1)

    validation_status: ValidationStatus = ValidationStatus.CANDIDATE


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