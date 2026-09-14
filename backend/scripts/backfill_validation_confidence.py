from __future__ import annotations

import argparse
import copy
import sys
import uuid
from pathlib import Path

from sqlalchemy import exists
from sqlalchemy.orm import Session


# Run from backend root with:
#   python scripts/backfill_validation_confidence.py
#   python scripts/backfill_validation_confidence.py --apply
#
# When executed by file path, Python puts the scripts directory on sys.path.
# Add the backend root so imports such as `app.*` resolve consistently.
BACKEND_ROOT = Path(__file__).resolve().parents[1]

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


from app.db.session import get_db
from app.models.interview_analysis import (
    InterviewAnalysis,
    KnowledgeCandidate,
)
from app.models.knowledge_core import Validation
from app.services.knowledge_validation_confidence_service import (
    VALIDATION_METHOD_VERSION,
    VALIDATION_TYPE,
    _assess_candidate,
)


PROTECTED_CANDIDATE_FIELDS = (
    "analysis_id",
    "statement",
    "knowledge_type",
    "context",
    "decision_rule",
    "rationale",
    "exception",
    "novelty_score",
    "confidence_score",
    "validation_status",
    "review_status",
    "review_reason",
    "review_synthesis_id",
    "created_at",
)


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            f"Invalid UUID: {value}"
        ) from exc


def _candidate_snapshot(
    candidate: KnowledgeCandidate,
) -> dict[str, object]:
    return {
        field: copy.deepcopy(
            getattr(candidate, field)
        )
        for field in PROTECTED_CANDIDATE_FIELDS
    }


def _get_target_candidates(
    db: Session,
    mission_id: uuid.UUID | None,
) -> list[tuple[KnowledgeCandidate, uuid.UUID]]:
    """
    Backfill target:
    - Candidate is still CANDIDATE
    - Candidate is waiting in Human Review
    - Current POC_V1 AUTO_CONFIDENCE row does not exist

    This intentionally excludes:
    - VERIFIED / REJECTED candidates
    - CANDIDATE rows that are not REVIEW_REQUIRED
    - rows already assessed with the current method version
    """

    current_validation_exists = exists().where(
        Validation.candidate_id
        == KnowledgeCandidate.candidate_id,
        Validation.validation_type
        == VALIDATION_TYPE,
        Validation.method_version
        == VALIDATION_METHOD_VERSION,
    )

    query = (
        db.query(
            KnowledgeCandidate,
            InterviewAnalysis.mission_id,
        )
        .join(
            InterviewAnalysis,
            InterviewAnalysis.analysis_id
            == KnowledgeCandidate.analysis_id,
        )
        .filter(
            KnowledgeCandidate.validation_status
            == "CANDIDATE",
            KnowledgeCandidate.review_status
            == "REVIEW_REQUIRED",
            ~current_validation_exists,
        )
    )

    if mission_id is not None:
        query = query.filter(
            InterviewAnalysis.mission_id
            == mission_id
        )

    return (
        query.order_by(
            InterviewAnalysis.mission_id.asc(),
            KnowledgeCandidate.created_at.asc(),
            KnowledgeCandidate.candidate_id.asc(),
        )
        .all()
    )


def run_backfill(
    db: Session,
    *,
    mission_id: uuid.UUID | None,
    apply: bool,
) -> int:
    targets = _get_target_candidates(
        db=db,
        mission_id=mission_id,
    )

    scope = (
        str(mission_id)
        if mission_id is not None
        else "ALL_MISSIONS"
    )

    print(
        "[validation-confidence-backfill] "
        f"scope={scope} "
        f"method={VALIDATION_METHOD_VERSION} "
        f"target_count={len(targets)}"
    )

    if not targets:
        print(
            "[validation-confidence-backfill] "
            "No backfill targets found."
        )
        return 0

    for index, (candidate, candidate_mission_id) in enumerate(
        targets,
        start=1,
    ):
        print(
            "[validation-confidence-backfill] "
            f"target {index}/{len(targets)} "
            f"mission_id={candidate_mission_id} "
            f"candidate_id={candidate.candidate_id}"
        )

    if not apply:
        print(
            "[validation-confidence-backfill] "
            "DRY RUN only. No database rows were changed. "
            "Re-run with --apply to insert Validation rows."
        )
        return len(targets)

    before_snapshots = {
        candidate.candidate_id: _candidate_snapshot(candidate)
        for candidate, _ in targets
    }

    created_or_reused: list[Validation] = []

    try:
        for index, (candidate, candidate_mission_id) in enumerate(
            targets,
            start=1,
        ):
            validation = _assess_candidate(
                db=db,
                candidate=candidate,
            )
            created_or_reused.append(validation)

            print(
                "[validation-confidence-backfill] "
                f"assessed {index}/{len(targets)} "
                f"mission_id={candidate_mission_id} "
                f"candidate_id={candidate.candidate_id} "
                f"validation_id={validation.validation_id} "
                f"score={validation.confidence_score} "
                f"method={validation.method_version}"
            )

        # Hard guard: this backfill may only add Validation rows.
        # Candidate content / review state must remain bit-for-bit unchanged.
        db.flush()

        for candidate, _ in targets:
            db.refresh(candidate)

            before = before_snapshots[
                candidate.candidate_id
            ]
            after = _candidate_snapshot(candidate)

            if before != after:
                changed_fields = [
                    field
                    for field in PROTECTED_CANDIDATE_FIELDS
                    if before[field] != after[field]
                ]

                raise RuntimeError(
                    "Backfill attempted to modify protected "
                    "KnowledgeCandidate fields. "
                    f"candidate_id={candidate.candidate_id}, "
                    f"changed_fields={changed_fields}"
                )

        db.commit()

    except Exception:
        db.rollback()
        raise

    print(
        "[validation-confidence-backfill] "
        f"COMPLETED inserted_or_reused={len(created_or_reused)} "
        "candidate_content_changed=0 "
        "review_state_changed=0"
    )

    return len(created_or_reused)


def _open_db() -> tuple[Session, object]:
    """
    Reuse the same DB dependency that FastAPI already uses.
    Keeping the generator object alive ensures its cleanup/finally block runs.
    """

    dependency = get_db()
    db = next(dependency)

    if not isinstance(db, Session):
        # SQLAlchemy Session subclasses still satisfy isinstance(Session).
        # Keep this explicit because this is a one-time administrative script.
        raise RuntimeError(
            "app.db.session.get_db() did not yield a SQLAlchemy Session"
        )

    return db, dependency


def _close_db(
    db: Session,
    dependency: object,
) -> None:
    try:
        next(dependency)
    except StopIteration:
        pass
    finally:
        if db.is_active:
            db.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Backfill POC_V1 Validation Confidence only for "
            "CANDIDATE + REVIEW_REQUIRED candidates that do not "
            "yet have a current AUTO_CONFIDENCE row."
        )
    )
    parser.add_argument(
        "--mission-id",
        type=_parse_uuid,
        default=None,
        help=(
            "Optional Mission UUID. Omit to backfill all missions."
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help=(
            "Actually insert Validation rows. "
            "Without this flag the script is dry-run only."
        ),
    )

    args = parser.parse_args()

    db, dependency = _open_db()

    try:
        run_backfill(
            db=db,
            mission_id=args.mission_id,
            apply=args.apply,
        )
    finally:
        _close_db(
            db=db,
            dependency=dependency,
        )


if __name__ == "__main__":
    main()
