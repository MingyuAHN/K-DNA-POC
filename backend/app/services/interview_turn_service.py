import uuid
from typing import Any

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
    complete_interview,
    count_interview_messages_by_role,
    get_interview,
)


# ============================================================
# Interview 종료 정책
# ============================================================

MAX_FOLLOW_UP_QUESTIONS = 6


def _convert_message_for_ai(
    message: Any,
) -> dict[str, Any]:
    """
    Backend 내부 Interview Message의 role 필드를
    AI 서버 Contract의 speaker 필드로 변환한다.

    Backend:
        role = USER / ASSISTANT

    AI:
        speaker = USER / ASSISTANT
    """

    data = message.model_dump(
        mode="json"
    )

    role = data.pop(
        "role",
        None,
    )

    if role is not None:
        data["speaker"] = role

    return data


def run_interview_turn(
    db: Session,
    interview_id: uuid.UUID,
    request: InterviewTurnRequest,
) -> InterviewTurnResponse:

    # ---------------------------------------------------------
    # 0. Interview 존재 / 상태 확인
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

    if interview.status == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Interview is already completed",
        )

    if interview.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Interview is cancelled",
        )

    content = request.content.strip()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content is required",
        )

    # ---------------------------------------------------------
    # 현재까지 AI가 생성한 후속 질문 수
    #
    # 예:
    # ASSISTANT 메시지가 이미 6개라면
    # 이번 Expert 답변까지는 분석하지만
    # 7번째 질문은 만들지 않고 종료한다.
    # ---------------------------------------------------------
    assistant_question_count = (
        count_interview_messages_by_role(
            db=db,
            interview_id=interview_id,
            role="ASSISTANT",
        )
    )

    reached_question_limit = (
        assistant_question_count
        >= MAX_FOLLOW_UP_QUESTIONS
    )

    # ---------------------------------------------------------
    # 1. Expert 답변 USER Message 저장
    #
    # AI 호출 실패 시에도 Expert 답변은 보존한다.
    # ---------------------------------------------------------
    user_message = add_interview_message(
        db=db,
        interview_id=interview_id,
        role="USER",
        content=content,
    )

    try:
        # -----------------------------------------------------
        # 2. Context 구성
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
        # 3. AI Request 구성
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
                _convert_message_for_ai(
                    context.message
                )
            ),
            "conversation_context": [
                _convert_message_for_ai(
                    item
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
        # 4. 실제 AI Interview Analyze 호출
        # -----------------------------------------------------
        ai_result = ai_client.analyze_interview(
            payload=ai_payload,
        )

        # -----------------------------------------------------
        # 5. 다음 질문 저장 여부 결정
        #
        # 종료 조건:
        #
        # A. AI가 next_question = null 반환
        # B. Backend 최대 후속 질문 수 도달
        # -----------------------------------------------------
        ai_requested_completion = (
            ai_result.next_question is None
        )

        should_complete = (
            ai_requested_completion
            or reached_question_limit
        )

        assistant_message = None

        if (
            ai_result.next_question is not None
            and not reached_question_limit
        ):
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
        # 6. Interview Analysis 저장
        #
        # AI가 실제로 반환한 결과는 그대로 저장한다.
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
        # 7. 실제 사용자에게 전달한 AI 질문에
        # provenance 기록
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
        # 8. 자동 Interview 종료
        #
        # AI가 더 이상 질문할 게 없거나,
        # Backend 질문 제한에 도달한 경우.
        # -----------------------------------------------------
        if should_complete:
            complete_interview(
                db=db,
                interview_id=interview_id,
            )

        # -----------------------------------------------------
        # 9. Frontend에 반환할 next_question
        #
        # Backend 제한으로 종료한 경우에는
        # AI가 질문을 제안했더라도 사용자에게는
        # next_question=null로 반환한다.
        # -----------------------------------------------------
        response_next_question = (
            None
            if should_complete
            else ai_result.next_question
        )

        # -----------------------------------------------------
        # 10. Frontend Response
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
                response_next_question
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