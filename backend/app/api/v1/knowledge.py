import uuid

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.knowledge import (
    KnowledgeCandidateValidationRequest,
    KnowledgeUnitDetailResponse,
    KnowledgeUnitResponse,
    ValidationResponse,
)
from app.services.knowledge_service import (
    get_knowledge_evidence,
    get_knowledge_unit,
    get_mission_knowledge_units,
    validate_knowledge_candidate,
)


router = APIRouter(
    prefix="/api/v1",
    tags=["knowledge"],
)


@router.post(
    "/knowledge-candidates/{candidate_id}/validate",
    response_model=ValidationResponse,
)
def validate_candidate_api(
    candidate_id: uuid.UUID,
    request: KnowledgeCandidateValidationRequest,
    db: Session = Depends(get_db),
):
    validation, knowledge_unit = (
        validate_knowledge_candidate(
            db=db,
            candidate_id=candidate_id,
            request=request,
        )
    )

    return ValidationResponse(
        validation_id=validation.validation_id,
        candidate_id=validation.candidate_id,
        knowledge_id=validation.knowledge_id,
        status=validation.status,
        reason=validation.reason,
        validated_by=validation.validated_by,
        knowledge_unit=knowledge_unit,
    )


@router.get(
    "/missions/{mission_id}/knowledge-units",
    response_model=list[KnowledgeUnitResponse],
)
def get_mission_knowledge_units_api(
    mission_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    return get_mission_knowledge_units(
        db=db,
        mission_id=mission_id,
    )


@router.get(
    "/knowledge-units/{knowledge_id}",
    response_model=KnowledgeUnitDetailResponse,
)
def get_knowledge_unit_api(
    knowledge_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    knowledge = get_knowledge_unit(
        db=db,
        knowledge_id=knowledge_id,
    )

    if knowledge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge unit not found",
        )

    evidence = get_knowledge_evidence(
        db=db,
        knowledge_id=knowledge_id,
    )

    return KnowledgeUnitDetailResponse(
        knowledge_id=knowledge.knowledge_id,
        mission_id=knowledge.mission_id,
        source_candidate_id=(
            knowledge.source_candidate_id
        ),
        knowledge_type=(
            knowledge.knowledge_type
        ),
        statement=knowledge.statement,
        context=knowledge.context,
        decision_rule=knowledge.decision_rule,
        rationale=knowledge.rationale,
        exception=knowledge.exception,
        status=knowledge.status,
        confidence_score=(
            float(knowledge.confidence_score)
            if knowledge.confidence_score
            is not None
            else None
        ),
        version=knowledge.version,
        root_knowledge_id=(
            knowledge.root_knowledge_id
        ),
        supersedes_id=(
            knowledge.supersedes_id
        ),
        change_reason=knowledge.change_reason,
        created_at=knowledge.created_at,
        updated_at=knowledge.updated_at,
        evidence=evidence,
    )