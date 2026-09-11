import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.interview_message import (
    InterviewMessage,
)
from app.models.knowledge_core import (
    KnowledgeUnit,
)
from app.schemas.interview_context import (
    ConversationMessageItem,
    CurrentMessageItem,
    InterviewContextItem,
    InterviewContextPreviewRequest,
    InterviewContextPreviewResponse,
    MissionContextItem,
    RetrievedEvidenceItem,
    RetrievedKnowledgeItem,
    RetrievedKnowledgeUnitItem,
)
from app.services.interview_service import (
    get_interview,
)
from app.services.mission_service import (
    get_mission,
)
from app.services.retrieval_service import (
    create_query_embedding,
    search_baseline_claims,
    search_document_chunks,
)


def get_interview_message(
    db: Session,
    message_id: uuid.UUID,
) -> InterviewMessage | None:

    return (
        db.query(InterviewMessage)
        .filter(
            InterviewMessage.message_id
            == message_id
        )
        .first()
    )


def get_previous_messages(
    db: Session,
    interview_id: uuid.UUID,
    current_sequence: int,
    limit: int,
) -> list[InterviewMessage]:

    rows = (
        db.query(InterviewMessage)
        .filter(
            InterviewMessage.interview_id
            == interview_id,
            InterviewMessage.sequence
            < current_sequence,
        )
        .order_by(
            InterviewMessage.sequence.desc()
        )
        .limit(limit)
        .all()
    )

    # DB에서는 최신 순으로 가져왔으므로
    # AI Context에는 시간 순서대로 전달
    rows.reverse()

    return rows


def get_active_verified_knowledge_units(
    db: Session,
    mission_id: uuid.UUID,
) -> list[KnowledgeUnit]:
    """
    AI retrieved_knowledge_units v1 Contract.

    같은 Mission에서 현재 활성 상태이면서
    검증 완료된 Knowledge Unit만 전달한다.

    현재 Knowledge version 정책:
    - 현재 활성 version: VERIFIED
    - 이전 version: SUPERSEDED

    따라서 v1에서는 status == VERIFIED를
    current/active 조건으로 사용한다.

    Knowledge Unit 전용 embedding retrieval은
    아직 없으므로 similarity는 Context DTO에서
    null로 전달한다.
    """

    return (
        db.query(KnowledgeUnit)
        .filter(
            KnowledgeUnit.mission_id
            == mission_id,
            KnowledgeUnit.status
            == "VERIFIED",
        )
        .order_by(
            KnowledgeUnit.updated_at.desc(),
            KnowledgeUnit.created_at.desc(),
        )
        .all()
    )


def build_interview_context(
    db: Session,
    interview_id: uuid.UUID,
    request: InterviewContextPreviewRequest,
) -> InterviewContextPreviewResponse:

    # ----------------------------------------
    # 1. Interview 조회
    # ----------------------------------------
    interview = get_interview(
        db=db,
        interview_id=interview_id,
    )

    if interview is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    # ----------------------------------------
    # 2. 현재 Message 조회
    # ----------------------------------------
    message = get_interview_message(
        db=db,
        message_id=request.message_id,
    )

    if message is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview message not found",
        )

    # 다른 Interview의 Message가 섞이는 것 방지
    if message.interview_id != interview_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Message does not belong "
                "to this interview"
            ),
        )

    # 현재 단계에서는 USER 답변을 기준으로
    # Retrieval Context를 만드는 구조
    if message.role != "USER":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Context preview requires "
                "a USER message"
            ),
        )

    # ----------------------------------------
    # 3. Mission 조회
    # ----------------------------------------
    mission = get_mission(
        db=db,
        mission_id=interview.mission_id,
    )

    if mission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )

    # ----------------------------------------
    # 4. 이전 대화 히스토리 조회
    #
    # 현재 Message는 message 필드에 별도로
    # 들어가므로 conversation_context에서는 제외
    # ----------------------------------------
    previous_messages = get_previous_messages(
        db=db,
        interview_id=interview_id,
        current_sequence=message.sequence,
        limit=request.history_limit,
    )

    conversation_context = [
        ConversationMessageItem(
            message_id=row.message_id,
            role=row.role,
            content=row.content,
            sequence=row.sequence,
            created_at=row.created_at,
        )
        for row in previous_messages
    ]

    retrieved_knowledge = []
    retrieved_knowledge_units = []
    retrieved_evidence = []

    # ----------------------------------------
    # 5. Retrieval
    #
    # retrieved_knowledge
    #   → Baseline Claim 전용
    #
    # retrieved_knowledge_units
    #   → 같은 Mission의 current/active
    #     + VERIFIED Knowledge Unit
    #
    # retrieved_evidence
    #   → Document Chunk
    #
    # Baseline Claim / Chunk 검색에 필요한
    # Query Embedding은 동일 Message에 대해
    # 한 번만 생성한다.
    #
    # Knowledge Unit은 현재 별도 embedding이
    # 없으므로 Mission + VERIFIED 조건으로 조회.
    # ----------------------------------------
    if request.include_retrieval:

        query_vector = create_query_embedding(
            query_text=message.content,
        )

        knowledge_results = (
            search_baseline_claims(
                db=db,
                mission_id=mission.mission_id,
                query_vector=query_vector,
                top_k=request.knowledge_top_k,
            )
        )

        evidence_results = (
            search_document_chunks(
                db=db,
                mission_id=mission.mission_id,
                query_vector=query_vector,
                top_k=request.evidence_top_k,
            )
        )

        knowledge_unit_results = (
            get_active_verified_knowledge_units(
                db=db,
                mission_id=mission.mission_id,
            )
        )

        retrieved_knowledge = [
            RetrievedKnowledgeItem(
                claim_id=row.id,
                claim_type=(
                    row.claim_type or "UNKNOWN"
                ),
                statement=row.text,
                similarity=row.similarity,
                source_chunk_id=(
                    row.source_chunk_id
                ),
                document_id=row.document_id,
                file_name=row.file_name,
                page=row.page,
                section=row.section,
            )
            for row in knowledge_results
            if row.source_chunk_id is not None
        ]

        retrieved_knowledge_units = [
            RetrievedKnowledgeUnitItem(
                knowledge_id=(
                    row.knowledge_id
                ),
                knowledge_type=(
                    row.knowledge_type
                ),
                statement=row.statement,
                context=(
                    row.context or {}
                ),
                validation_status="VERIFIED",
                version=row.version,
                confidence_score=(
                    float(
                        row.confidence_score
                    )
                    if row.confidence_score
                    is not None
                    else None
                ),
                similarity=None,
                decision_rule=(
                    row.decision_rule
                ),
                rationale=row.rationale,
                exception=row.exception,
            )
            for row in knowledge_unit_results
        ]

        retrieved_evidence = [
            RetrievedEvidenceItem(
                chunk_id=row.id,
                content=row.text,
                similarity=row.similarity,
                document_id=row.document_id,
                file_name=row.file_name,
                page=row.page,
                section=row.section,
            )
            for row in evidence_results
        ]

    # ----------------------------------------
    # 6. AI 전달용 Context 완성
    # ----------------------------------------
    return InterviewContextPreviewResponse(
        mission=MissionContextItem(
            mission_id=mission.mission_id,
            title=mission.title,
            domain=mission.domain,
            objective=mission.objective,
        ),
        interview=InterviewContextItem(
            interview_id=interview.interview_id,
            expert_id=interview.expert_id,
            title=interview.title,
            status=interview.status,
        ),
        message=CurrentMessageItem(
            message_id=message.message_id,
            role=message.role,
            content=message.content,
            sequence=message.sequence,
            created_at=message.created_at,
        ),
        conversation_context=(
            conversation_context
        ),
        retrieved_knowledge=(
            retrieved_knowledge
        ),
        retrieved_knowledge_units=(
            retrieved_knowledge_units
        ),
        retrieved_evidence=(
            retrieved_evidence
        ),
    )