import logging
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
from app.services.auto_knowledge_sync_service import (
    sync_analysis_to_knowledge,
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


logger = logging.getLogger(__name__)


def _convert_message_for_ai(
    message: Any,
) -> dict[str, Any]:
    """
    Backend 내부에서는 role을 사용하고,
    AI 서버 요청 시 speaker로 변환한다.
    """

    data = message.model_dump(
        mode="json",
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
    # 1. Interview 조회 및 상태 확인
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
    # 2. 전문가 답변 저장
    # ---------------------------------------------------------
    user_message = add_interview_message(
        db=db,
        interview_id=interview_id,
        role="USER",
        content=content,
    )

    try:
        # -----------------------------------------------------
        # 3. Interview Context 생성
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
        # 4. AI 요청 Payload 생성
        #
        # retrieved_knowledge
        #   → Baseline Claim
        #
        # retrieved_knowledge_units
        #   → 동일 Mission의 current/active
        #     + VERIFIED Knowledge Unit
        #
        # retrieved_evidence
        #   → Document Chunk
        # -----------------------------------------------------
        ai_payload = {
            "mission": (
                context.mission.model_dump(
                    mode="json",
                )
            ),
            "interview": (
                context.interview.model_dump(
                    mode="json",
                )
            ),
            "message": (
                _convert_message_for_ai(
                    context.message,
                )
            ),
            "conversation_context": [
                _convert_message_for_ai(
                    item,
                )
                for item
                in context.conversation_context
            ],
            "retrieved_knowledge": [
                item.model_dump(
                    mode="json",
                )
                for item
                in context.retrieved_knowledge
            ],
            "retrieved_knowledge_units": [
                item.model_dump(
                    mode="json",
                )
                for item
                in context.retrieved_knowledge_units
            ],
            "retrieved_evidence": [
                item.model_dump(
                    mode="json",
                )
                for item
                in context.retrieved_evidence
            ],
        }

        # -----------------------------------------------------
        # 5. AI Interview Analyze 호출
        # -----------------------------------------------------
        ai_result = ai_client.analyze_interview(
            payload=ai_payload,
        )

        # -----------------------------------------------------
        # 6. AI 후속 질문 저장
        #
        # PoC 정책:
        # AI는 Interview를 종료시키지 않는다.
        #
        # next_question=None이어도
        # Interview 상태는 COMPLETED로 변경하지 않는다.
        #
        # Interview 종료는 사용자가
        # /complete API를 호출할 때만 수행한다.
        # -----------------------------------------------------
        assistant_message = None

        if ai_result.next_question is not None:
            assistant_message = add_interview_message(
                db=db,
                interview_id=interview_id,
                role="ASSISTANT",
                content=(
                    ai_result.next_question.question
                ),
            )

        # -----------------------------------------------------
        # 7. Candidate / Gap / Conflict / Question 저장
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
        # 8. 선택된 AI 질문 provenance 저장
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

            db.refresh(
                assistant_message
            )

        # -----------------------------------------------------
        # 9. Auto Knowledge Sync
        #
        # 이번 Turn에서 생성된 Candidate들을 대상으로:
        #
        # Candidate
        #   → 관련 Knowledge 선별
        #   → Synthesis
        #   → Guardrail
        #   → Auto APPROVE
        #   → Knowledge Unit / Relation / Version
        #
        # 을 자동 처리한다.
        #
        # 중요:
        # Knowledge Sync 실패는 Interview Turn 자체를
        # 실패시키지 않는다.
        #
        # 전문가의 답변 / 분석 / 다음 질문은 이미 DB에
        # 저장됐으므로 DNA 후처리가 실패하더라도
        # Interview는 계속 진행할 수 있어야 한다.
        # -----------------------------------------------------
        try:
            knowledge_sync_result = (
                sync_analysis_to_knowledge(
                    db=db,
                    analysis_id=(
                        analysis.analysis_id
                    ),
                )
            )

            logger.info(
                (
                    "Auto knowledge sync completed "
                    "analysis_id=%s "
                    "mission_id=%s "
                    "processed=%s "
                    "skipped=%s "
                    "review_required=%s "
                    "failed=%s"
                ),
                analysis.analysis_id,
                interview.mission_id,
                knowledge_sync_result.processed,
                knowledge_sync_result.skipped,
                (
                    knowledge_sync_result
                    .review_required
                ),
                knowledge_sync_result.failed,
            )

            if (
                knowledge_sync_result.failed > 0
                or
                knowledge_sync_result
                .review_required > 0
            ):
                logger.warning(
                    (
                        "Auto knowledge sync "
                        "completed with unresolved "
                        "items analysis_id=%s "
                        "review_required=%s "
                        "failed=%s"
                    ),
                    analysis.analysis_id,
                    (
                        knowledge_sync_result
                        .review_required
                    ),
                    knowledge_sync_result.failed,
                )

        except Exception as sync_exc:

            # Auto Knowledge Sync 과정에서
            # 열린 트랜잭션이 남아 있을 가능성에 대비한다.
            db.rollback()

            logger.exception(
                (
                    "Auto knowledge sync failed "
                    "but interview turn will "
                    "continue. "
                    "analysis_id=%s "
                    "interview_id=%s "
                    "error=%s"
                ),
                analysis.analysis_id,
                interview_id,
                str(sync_exc),
            )

        # -----------------------------------------------------
        # 10. Frontend 응답
        #
        # Knowledge Sync 결과는 현재 Turn Response Schema에
        # 추가하지 않는다.
        #
        # /turns가 성공하면 Frontend는 기존
        # knowledge-graph API를 다시 조회하면 된다.
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
            user_message=user_message.content,
            knowledge_candidates=(
                ai_result.knowledge_candidates
            ),
            gaps=ai_result.gaps,
            conflicts=ai_result.conflicts,
            question_candidates=(
                ai_result.question_candidates
            ),
            next_question=(
                ai_result.next_question
            ),
        )

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