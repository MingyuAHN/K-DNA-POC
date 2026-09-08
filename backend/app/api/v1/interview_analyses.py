import uuid

from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.interview_analysis import (
    InterviewAnalysisDetailResponse,
)
from app.services.interview_analysis_query_service import (
    get_interview_analysis_detail,
)


router = APIRouter(
    prefix="/api/v1",
    tags=["interview-analysis"],
)


@router.get(
    "/interview-analyses/{analysis_id}",
    response_model=InterviewAnalysisDetailResponse,
)
def get_interview_analysis_api(
    analysis_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    return get_interview_analysis_detail(
        db=db,
        analysis_id=analysis_id,
    )