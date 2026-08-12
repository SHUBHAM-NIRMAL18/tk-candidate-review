from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth import get_current_user
from app.schemas.analytics import AnalyticsResponse
from app.services.analytics_service import get_analytics_service

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])

@router.get("", response_model=AnalyticsResponse)
def get_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get aggregated analytics for candidate hiring pipeline, score distribution,
    evaluation category benchmarks, in-demand skills, and reviewer metrics.
    Strictly follows RBAC projection: reviewers only receive their personal contribution metrics.
    """
    return get_analytics_service(db=db, current_user=current_user)
