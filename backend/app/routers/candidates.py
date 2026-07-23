from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth import get_current_user
from app.schemas.candidate import (
    CandidateCreate,
    CandidateUpdate,
    CandidateRead,
    CandidateDetailRead,
    CandidateListResponse,
    ScoreCreate,
    ScoreRead,
    AISummaryResponse
)
from app.services.candidate_service import (
    list_candidates_service,
    get_candidate_detail_service,
    create_candidate_service,
    update_candidate_service,
    soft_delete_candidate_service,
    create_score_service,
    generate_ai_summary_service,
    broadcaster
)

router = APIRouter(prefix="/api/v1/candidates", tags=["Candidates"])

@router.get("", response_model=CandidateListResponse)
def list_candidates(
    status: Optional[str] = Query(None, description="Filter by candidate status"),
    role_applied: Optional[str] = Query(None, description="Filter by role applied"),
    skill: Optional[str] = Query(None, description="Filter by skill tag"),
    keyword: Optional[str] = Query(None, description="Search keyword in name, email, skills"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return list_candidates_service(
        db=db,
        current_user=current_user,
        status_filter=status,
        role_applied=role_applied,
        skill=skill,
        keyword=keyword,
        page=page,
        page_size=page_size
    )

@router.post("", response_model=CandidateRead, status_code=status.HTTP_201_CREATED)
def create_candidate(
    candidate_in: CandidateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return create_candidate_service(db=db, candidate_in=candidate_in, current_user=current_user)

@router.get("/{candidate_id}", response_model=CandidateDetailRead)
def get_candidate(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_candidate_detail_service(db=db, candidate_id=candidate_id, current_user=current_user)

@router.patch("/{candidate_id}", response_model=CandidateRead)
def update_candidate(
    candidate_id: str,
    candidate_in: CandidateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return update_candidate_service(
        db=db,
        candidate_id=candidate_id,
        candidate_in=candidate_in,
        current_user=current_user
    )

@router.delete("/{candidate_id}")
def delete_candidate(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return soft_delete_candidate_service(db=db, candidate_id=candidate_id)

@router.post("/{candidate_id}/scores", response_model=ScoreRead, status_code=status.HTTP_201_CREATED)
async def submit_candidate_score(
    candidate_id: str,
    score_in: ScoreCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return await create_score_service(
        db=db,
        candidate_id=candidate_id,
        score_in=score_in,
        current_user=current_user
    )

@router.post("/{candidate_id}/summary", response_model=AISummaryResponse)
async def trigger_ai_summary(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return await generate_ai_summary_service(db=db, candidate_id=candidate_id)

@router.get("/{candidate_id}/stream")
async def stream_candidate_scores(
    candidate_id: str,
    current_user: User = Depends(get_current_user)
):
    queue = broadcaster.subscribe(candidate_id)

    async def event_generator():
        try:
            while True:
                data = await queue.get()
                yield data
        except Exception:
            pass
        finally:
            broadcaster.unsubscribe(candidate_id, queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
