from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth import get_current_user, require_role
from app.cache import (
    cache,
    make_candidates_list_key,
    make_candidate_detail_key,
    invalidate_candidate_caches
)
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
    response: Response,
    status: Optional[str] = Query(None, description="Filter by candidate status"),
    role_applied: Optional[str] = Query(None, description="Filter by role applied"),
    skill: Optional[str] = Query(None, description="Filter by skill tag"),
    keyword: Optional[str] = Query(None, description="Search keyword in name, email, skills"),
    sort_by: Optional[str] = Query(None, description="Sort column: average_score, name, role_applied, status, created_at"),
    sort_order: Optional[str] = Query("desc", description="Sort order: asc or desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cache_key = make_candidates_list_key(
        role=current_user.role,
        status_filter=status,
        role_applied=role_applied,
        skill=skill,
        keyword=keyword,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size
    )

    cached = cache.get(cache_key)
    if cached is not None:
        response.headers["X-Cache-Status"] = "HIT"
        return CandidateListResponse(**cached)

    result = list_candidates_service(
        db=db,
        current_user=current_user,
        status_filter=status,
        role_applied=role_applied,
        skill=skill,
        keyword=keyword,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size
    )

    cache.set(cache_key, result.model_dump(), ttl=60)
    response.headers["X-Cache-Status"] = "MISS"
    return result

@router.post("", response_model=CandidateRead, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    candidate_in: CandidateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    created = await create_candidate_service(db=db, candidate_in=candidate_in, current_user=current_user)
    invalidate_candidate_caches(candidate_id=created.id)
    return created

@router.get("/{candidate_id}", response_model=CandidateDetailRead)
def get_candidate(
    candidate_id: str,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cache_key = make_candidate_detail_key(
        role=current_user.role,
        user_id=current_user.id,
        candidate_id=candidate_id
    )

    cached = cache.get(cache_key)
    if cached is not None:
        response.headers["X-Cache-Status"] = "HIT"
        return CandidateDetailRead(**cached)

    result = get_candidate_detail_service(db=db, candidate_id=candidate_id, current_user=current_user)
    cache.set(cache_key, result.model_dump(), ttl=60)
    response.headers["X-Cache-Status"] = "MISS"
    return result

# Admin-only: only admins can modify candidate profiles (name, status, notes, etc.)
@router.patch("/{candidate_id}", response_model=CandidateRead)
async def update_candidate(
    candidate_id: str,
    candidate_in: CandidateUpdate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    updated = await update_candidate_service(
        db=db,
        candidate_id=candidate_id,
        candidate_in=candidate_in,
        current_user=current_user
    )
    invalidate_candidate_caches(candidate_id=candidate_id)
    return updated

# Admin-only: soft delete sets status='archived', never hard-deletes
@router.delete("/{candidate_id}")
async def delete_candidate(
    candidate_id: str,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    deleted = await soft_delete_candidate_service(db=db, candidate_id=candidate_id)
    invalidate_candidate_caches(candidate_id=candidate_id)
    return deleted

@router.post("/{candidate_id}/scores", response_model=ScoreRead, status_code=status.HTTP_201_CREATED)
async def submit_candidate_score(
    candidate_id: str,
    score_in: ScoreCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    scored = await create_score_service(
        db=db,
        candidate_id=candidate_id,
        score_in=score_in,
        current_user=current_user
    )
    invalidate_candidate_caches(candidate_id=candidate_id)
    return scored

@router.post("/{candidate_id}/summary", response_model=AISummaryResponse)
async def trigger_ai_summary(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    summary = await generate_ai_summary_service(db=db, candidate_id=candidate_id)
    invalidate_candidate_caches(candidate_id=candidate_id)
    return summary

@router.get("/{candidate_id}/stream")
async def stream_candidate_scores(
    candidate_id: str,
    current_user: User = Depends(get_current_user)
):
    """SSE stream that sends refresh signals when new scores are submitted."""
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
