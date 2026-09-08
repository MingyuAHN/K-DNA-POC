import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.clients.ai_client import (
    AIClientError,
    ai_client,
)
from app.schemas.interview_context import (
    InterviewContextPreviewRequest,
)
from app.schemas.interview_orchestration import (
    InterviewTurnRequest,
    InterviewTurnResponse,
)
from app.services.interview_analysis_service import (
    save_interview_analysis,
)
from app.services.interview_context_service import (
    build_interview_context,
)
from app.services.interview_service import (
    add_interview_message,
    get_interview,
)


def run_interview_turn(
    db: Session,
    interview_id: uuid.UUID,
    request: InterviewTurnRequest,
) -> InterviewTurnResponse:

    # ---------------------------------------------------------
    # 0. Interview 존재 여부 확인
    # ---------------------------------------------------------
    interview = get_interview(
        db=db,
        interview_id=interview_id,
    )

    if interview is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    content = request.content.strip()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content is required",
        )

    # ---------------------------------------------------------
    # 1. Expert 답변을 USER Message로 저장
    #
    # AI 호출에 실패하더라도 실제 Expert가 입력한 답변이므로
    # Interview History에는 그대로 남긴다.
    # ---------------------------------------------------------
    user_message = add_interview_message(
        db=db,
        interview_id=interview_id,
        role="USER",
        content=content,
    )

    try:
        # -----------------------------------------------------
        # 2. 이번 USER Message 기준 Context 구성
        #
        # conversation_context:
        #   현재 USER Message를 제외한 이전 대화
        #
        # retrieved_knowledge:
        #   Baseline Claim Retrieval 결과
        #
        # retrieved_evidence:
        #   Document Chunk Retrieval 결과
        # -----------------------------------------------------
        context = build_interview_context(
            db=db,
            interview_id=interview_id,
            request=InterviewContextPreviewRequest(
                message_id=user_message.message_id,
                include_retrieval=True,
                knowledge_top_k=(
                    request.knowledge_top_k
                ),
                evidence_top_k=(
                    request.evidence_top_k
                ),
                history_limit=(
                    request.history_limit
                ),
            ),
        )

        # -----------------------------------------------------
        # 3. AI Interview Orchestration Request 구성
        #
        # AI 팀과 합의한 Request 구조:
        #
        # mission
        # interview
        # message
        # conversation_context
        # retrieved_knowledge
        # retrieved_evidence
        # -----------------------------------------------------
        ai_payload = {
            "mission": (
                context.mission.model_dump(
                    mode="json"
                )
            ),
            "interview": (
                context.interview.model_dump(
                    mode="json"
                )
            ),
            "message": (
                context.message.model_dump(
                    mode="json"
                )
            ),
            "conversation_context": [
                item.model_dump(
                    mode="json"
                )
                for item
                in context.conversation_context
            ],
            "retrieved_knowledge": [
                item.model_dump(
                    mode="json"
                )
                for item
                in context.retrieved_knowledge
            ],
            "retrieved_evidence": [
                item.model_dump(
                    mode="json"
                )
                for item
                in context.retrieved_evidence
            ],
        }

        # -----------------------------------------------------
        # 4. AI Interview Orchestration 호출
        #
        # POST /api/v1/ai/interviews/analyze
        #
        # Response:
        # - knowledge_candidates
        # - gaps
        # - conflicts
        # - question_candidates
        # - next_question
        # -----------------------------------------------------
        ai_result = ai_client.analyze_interview(
            payload=ai_payload,
        )

        # -----------------------------------------------------
        # 5. AI가 선택한 Next Question이 있으면
        # ASSISTANT Message로 저장
        #
        # next_question은 null일 수 있음.
        # -----------------------------------------------------
        assistant_message = None

        if ai_result.next_question is not None:
            assistant_message = (
                add_interview_message(
                    db=db,
                    interview_id=interview_id,
                    role="ASSISTANT",
                    content=(
                        ai_result
                        .next_question
                        .question
                    ),
                )
            )

        # -----------------------------------------------------
        # 6. Interview Analysis 결과 저장
        #
        # 중요:
        # request_context에 실제 AI로 전달한 ai_payload 전체를
        # 저장한다.
        #
        # 따라서 나중에
        # "어떤 Context를 보고 이 Candidate / Gap / Conflict가
        # 생성됐는가?"
        # 를 추적할 수 있다.
        # -----------------------------------------------------
        analysis = save_interview_analysis(
            db=db,
            mission_id=interview.mission_id,
            interview_id=interview_id,
            source_message_id=(
                user_message.message_id
            ),
            assistant_message_id=(
                assistant_message.message_id
                if assistant_message is not None
                else None
            ),
            request_context=ai_payload,
            result=ai_result,
        )

        # -----------------------------------------------------
        # 7. 선택된 AI Question Message에
        # Analysis provenance 기록
        # -----------------------------------------------------
        if assistant_message is not None:
            assistant_message.metadata_ = {
                "source": (
                    "INTERVIEW_ORCHESTRATION"
                ),
                "analysis_id": str(
                    analysis.analysis_id
                ),
            }

            db.commit()
            db.refresh(assistant_message)

        # -----------------------------------------------------
        # 8. Frontend Response
        # -----------------------------------------------------
        return InterviewTurnResponse(
            analysis_id=analysis.analysis_id,

            interview_id=interview_id,

            user_message_id=(
                user_message.message_id
            ),

            assistant_message_id=(
                assistant_message.message_id
                if assistant_message is not None
                else None
            ),

            user_message=(
                user_message.content
            ),

            knowledge_candidates=(
                ai_result.knowledge_candidates
            ),

            gaps=(
                ai_result.gaps
            ),

            conflicts=(
                ai_result.conflicts
            ),

            question_candidates=(
                ai_result.question_candidates
            ),

            next_question=(
                ai_result.next_question
            ),
        )

    # ---------------------------------------------------------
    # AI 서버 연결 / 응답 오류
    # ---------------------------------------------------------
    except AIClientError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "AI interview service error: "
                f"{str(exc)}"
            ),
        )

    except HTTPException:
        raise

    # ---------------------------------------------------------
    # 기타 Backend 처리 오류
    # ---------------------------------------------------------
    except Exception as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Interview turn failed: "
                f"{str(exc)}"
            ),
        )