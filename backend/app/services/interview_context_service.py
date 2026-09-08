import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.interview_message import (
    InterviewMessage,
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
    retrieved_evidence = []

    # ----------------------------------------
    # 5. Retrieval
    #
    # 동일 사용자 메시지에 대해 Query Embedding은
    # 딱 한 번만 생성하고,
    # Claim / Chunk 검색에 함께 사용
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
        retrieved_evidence=(
            retrieved_evidence
        ),
    )