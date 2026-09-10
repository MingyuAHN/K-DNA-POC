import uuid

from fastapi import (
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.models.interview_analysis import (
    InterviewAnalysis,
    KnowledgeCandidate,
)
from app.models.knowledge_synthesis import (
    KnowledgeSynthesis,
)
from app.schemas.knowledge_synthesis import (
    AutoKnowledgeSyncItem,
    AutoKnowledgeSyncResponse,
    KnowledgeSynthesisRequest,
)
from app.schemas.knowledge_synthesis_apply import (
    KnowledgeSynthesisValidationRequest,
)
from app.services.knowledge_synthesis_apply_service import (
    validate_and_apply_synthesis,
)
from app.services.knowledge_synthesis_service import (
    synthesize_candidate,
)


AUTO_VALIDATED_BY = "K-DNA AUTO"

AUTO_VALIDATION_REASON = (
    "PoC interview candidate automatic "
    "knowledge promotion"
)


def _to_uuid_list(
    values,
) -> list[uuid.UUID]:

    result: list[uuid.UUID] = []

    for value in values or []:
        try:
            result.append(
                uuid.UUID(str(value))
            )
        except (
            ValueError,
            TypeError,
            AttributeError,
        ):
            continue

    return result


def _get_candidate_syntheses(
    db: Session,
    candidate_id: uuid.UUID,
) -> list[KnowledgeSynthesis]:

    return (
        db.query(KnowledgeSynthesis)
        .filter(
            KnowledgeSynthesis.candidate_id
            == candidate_id
        )
        .order_by(
            KnowledgeSynthesis
            .created_at
            .desc()
        )
        .all()
    )


def _find_applied_synthesis(
    syntheses: list[KnowledgeSynthesis],
) -> KnowledgeSynthesis | None:

    for synthesis in syntheses:
        if synthesis.status == "APPLIED":
            return synthesis

    return None


def _find_reusable_synthesis(
    syntheses: list[KnowledgeSynthesis],
) -> KnowledgeSynthesis | None:

    for synthesis in syntheses:
        if synthesis.status in {
            "PENDING",
            "APPROVED",
        }:
            return synthesis

    return None


def _has_rejected_synthesis(
    syntheses: list[KnowledgeSynthesis],
) -> bool:

    return any(
        synthesis.status == "REJECTED"
        for synthesis in syntheses
    )


def sync_analysis_to_knowledge(
    db: Session,
    analysis_id: uuid.UUID,
) -> AutoKnowledgeSyncResponse:

    # -----------------------------------------------------
    # 1. Interview Analysis 확인
    # -----------------------------------------------------
    analysis = (
        db.query(InterviewAnalysis)
        .filter(
            InterviewAnalysis.analysis_id
            == analysis_id
        )
        .first()
    )

    if analysis is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Interview analysis not found"
            ),
        )

    # -----------------------------------------------------
    # 2. 이번 Analysis에서 생성된 Candidate만 조회
    #
    # ORM 객체 자체를 오래 들고 있지 않고
    # candidate_id 목록으로 보관한다.
    #
    # Candidate별 실패 시 rollback이 발생해도
    # 다음 Candidate 처리를 계속하기 위함이다.
    # -----------------------------------------------------
    candidate_ids = [
        row.candidate_id
        for row in (
            db.query(KnowledgeCandidate)
            .filter(
                KnowledgeCandidate.analysis_id
                == analysis_id
            )
            .order_by(
                KnowledgeCandidate
                .created_at
                .asc()
            )
            .all()
        )
    ]

    processed = 0
    skipped = 0
    failed = 0

    items: list[
        AutoKnowledgeSyncItem
    ] = []

    # -----------------------------------------------------
    # 3. Candidate 단위 자동 처리
    # -----------------------------------------------------
    for candidate_id in candidate_ids:

        synthesis_id: (
            uuid.UUID | None
        ) = None

        try:
            syntheses = (
                _get_candidate_syntheses(
                    db=db,
                    candidate_id=candidate_id,
                )
            )

            # ---------------------------------------------
            # 이미 APPLIED된 Candidate
            #
            # 같은 Candidate를 다시 Sync해도
            # 새로운 Synthesis / Knowledge Unit을
            # 만들지 않는다.
            # ---------------------------------------------
            applied_synthesis = (
                _find_applied_synthesis(
                    syntheses
                )
            )

            if applied_synthesis is not None:

                skipped += 1

                items.append(
                    AutoKnowledgeSyncItem(
                        candidate_id=(
                            candidate_id
                        ),
                        status="SKIPPED",
                        synthesis_id=(
                            applied_synthesis
                            .synthesis_id
                        ),
                        resulting_knowledge_ids=(
                            _to_uuid_list(
                                applied_synthesis
                                .resulting_knowledge_ids
                            )
                        ),
                        detail=(
                            "Candidate already "
                            "has an APPLIED "
                            "synthesis"
                        ),
                    )
                )

                continue

            # ---------------------------------------------
            # 기존 PENDING / APPROVED Synthesis가
            # 존재하면 새로 AI Synthesis를 호출하지
            # 않고 기존 것을 재사용한다.
            # ---------------------------------------------
            reusable_synthesis = (
                _find_reusable_synthesis(
                    syntheses
                )
            )

            if reusable_synthesis is not None:

                synthesis_id = (
                    reusable_synthesis
                    .synthesis_id
                )

            else:
                # -----------------------------------------
                # REJECTED만 존재하는 Candidate는
                # 사람의 Reject 결정을 존중하고
                # 자동으로 다시 생성하지 않는다.
                # -----------------------------------------
                if _has_rejected_synthesis(
                    syntheses
                ):
                    skipped += 1

                    items.append(
                        AutoKnowledgeSyncItem(
                            candidate_id=(
                                candidate_id
                            ),
                            status="SKIPPED",
                            synthesis_id=None,
                            resulting_knowledge_ids=[],
                            detail=(
                                "Candidate has "
                                "only REJECTED "
                                "synthesis records"
                            ),
                        )
                    )

                    continue

                # -----------------------------------------
                # 신규 Candidate
                #
                # related_knowledge_ids=[]
                # → 기존 synthesize_candidate 내부에서
                # 같은 Mission의 활성 Knowledge를
                # 자동 조회한다.
                # -----------------------------------------
                synthesis_result = (
                    synthesize_candidate(
                        db=db,
                        candidate_id=(
                            candidate_id
                        ),
                        request=(
                            KnowledgeSynthesisRequest(
                                related_knowledge_ids=[]
                            )
                        ),
                    )
                )

                synthesis_id = (
                    synthesis_result
                    .synthesis_id
                )

            # ---------------------------------------------
            # Auto APPROVE
            #
            # 기존 Apply Service를 그대로 사용하므로
            # Knowledge Unit / Version / Relation /
            # Evidence 생성 로직을 중복 구현하지 않는다.
            # ---------------------------------------------
            apply_result = (
                validate_and_apply_synthesis(
                    db=db,
                    synthesis_id=(
                        synthesis_id
                    ),
                    request=(
                        KnowledgeSynthesisValidationRequest(
                            decision="APPROVE",
                            reason=(
                                AUTO_VALIDATION_REASON
                            ),
                            validated_by=(
                                AUTO_VALIDATED_BY
                            ),
                        )
                    ),
                )
            )

            processed += 1

            items.append(
                AutoKnowledgeSyncItem(
                    candidate_id=candidate_id,
                    status="APPLIED",
                    synthesis_id=synthesis_id,
                    resulting_knowledge_ids=(
                        apply_result
                        .resulting_knowledge_ids
                    ),
                    detail=(
                        "Candidate synthesized "
                        "and applied successfully"
                    ),
                )
            )

        except HTTPException as exc:

            db.rollback()

            failed += 1

            items.append(
                AutoKnowledgeSyncItem(
                    candidate_id=candidate_id,
                    status="FAILED",
                    synthesis_id=synthesis_id,
                    resulting_knowledge_ids=[],
                    detail=str(exc.detail),
                )
            )

        except Exception as exc:

            db.rollback()

            failed += 1

            items.append(
                AutoKnowledgeSyncItem(
                    candidate_id=candidate_id,
                    status="FAILED",
                    synthesis_id=synthesis_id,
                    resulting_knowledge_ids=[],
                    detail=str(exc),
                )
            )

    # -----------------------------------------------------
    # 4. 결과
    # -----------------------------------------------------
    return AutoKnowledgeSyncResponse(
        analysis_id=analysis_id,
        mission_id=analysis.mission_id,
        total_candidates=len(
            candidate_ids
        ),
        processed=processed,
        skipped=skipped,
        failed=failed,
        items=items,
    )