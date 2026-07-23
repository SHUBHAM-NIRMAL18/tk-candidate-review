import asyncio
import math
from typing import Dict, List, Optional, Set
from fastapi import HTTPException, status
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.models.score import Score
from app.models.user import User
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

class SSEBroadcaster:
    def __init__(self):
        self._listeners: Dict[str, Set[asyncio.Queue]] = {}

    def subscribe(self, candidate_id: str) -> asyncio.Queue:
        if candidate_id not in self._listeners:
            self._listeners[candidate_id] = set()
        queue: asyncio.Queue = asyncio.Queue()
        self._listeners[candidate_id].add(queue)
        return queue

    def unsubscribe(self, candidate_id: str, queue: asyncio.Queue):
        if candidate_id in self._listeners:
            self._listeners[candidate_id].discard(queue)
            if not self._listeners[candidate_id]:
                del self._listeners[candidate_id]

    async def broadcast(self, candidate_id: str, message: str):
        if candidate_id in self._listeners:
            for queue in list(self._listeners[candidate_id]):
                await queue.put(message)

broadcaster = SSEBroadcaster()

def list_candidates_service(
    db: Session,
    current_user: User,
    status_filter: Optional[str] = None,
    role_applied: Optional[str] = None,
    skill: Optional[str] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> CandidateListResponse:
    page_size = max(1, min(page_size, 50))
    page = max(1, page)

    query = db.query(Candidate)

    if status_filter:
        query = query.filter(Candidate.status == status_filter)
    else:
        query = query.filter(Candidate.status != "archived")

    if role_applied:
        query = query.filter(Candidate.role_applied.ilike(f"%{role_applied}%"))

    if skill:
        query = query.filter(Candidate.skills.ilike(f"%{skill}%"))

    if keyword:
        kw = f"%{keyword}%"
        query = query.filter(
            or_(
                Candidate.name.ilike(kw),
                Candidate.email.ilike(kw),
                Candidate.skills.ilike(kw),
                Candidate.role_applied.ilike(kw)
            )
        )

    total = query.count()
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size

    candidates = query.order_by(Candidate.created_at.desc()).offset(offset).limit(page_size).all()

    items = []
    for c in candidates:
        cand_dict = CandidateRead.model_validate(c).model_dump()
        if current_user.role != "admin":
            cand_dict["internal_notes"] = None

        scores = db.query(Score.score).filter(Score.candidate_id == c.id).all()
        if scores:
            avg = sum(s[0] for s in scores) / len(scores)
            cand_dict["average_score"] = round(avg, 1)
        else:
            cand_dict["average_score"] = None

        items.append(CandidateRead(**cand_dict))

    return CandidateListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

def get_candidate_detail_service(db: Session, candidate_id: str, current_user: User) -> CandidateDetailRead:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    score_query = db.query(Score, User.email).outerjoin(User, Score.reviewer_id == User.id).filter(Score.candidate_id == candidate_id)
    if current_user.role != "admin":
        score_query = score_query.filter(Score.reviewer_id == current_user.id)

    results = score_query.order_by(Score.created_at.desc()).all()
    score_reads = []
    for s_obj, u_email in results:
        s_dict = ScoreRead.model_validate(s_obj).model_dump()
        s_dict["reviewer_email"] = u_email
        score_reads.append(ScoreRead(**s_dict))

    cand_dict = CandidateRead.model_validate(candidate).model_dump()
    if current_user.role != "admin":
        cand_dict["internal_notes"] = None

    all_scores = db.query(Score.score).filter(Score.candidate_id == candidate_id).all()
    if all_scores:
        avg = sum(s[0] for s in all_scores) / len(all_scores)
        cand_dict["average_score"] = round(avg, 1)
    else:
        cand_dict["average_score"] = None

    return CandidateDetailRead(**cand_dict, scores=score_reads)

def create_candidate_service(db: Session, candidate_in: CandidateCreate, current_user: User) -> CandidateRead:
    notes = candidate_in.internal_notes if current_user.role == "admin" else None
    candidate = Candidate(
        name=candidate_in.name,
        email=candidate_in.email,
        role_applied=candidate_in.role_applied,
        status=candidate_in.status,
        skills=candidate_in.skills,
        internal_notes=notes
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    cand_dict = CandidateRead.model_validate(candidate).model_dump()
    if current_user.role != "admin":
        cand_dict["internal_notes"] = None

    return CandidateRead(**cand_dict)

def update_candidate_service(
    db: Session, candidate_id: str, candidate_in: CandidateUpdate, current_user: User
) -> CandidateRead:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    if candidate_in.internal_notes is not None and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can modify internal notes"
        )

    for field, val in candidate_in.model_dump(exclude_unset=True).items():
        setattr(candidate, field, val)

    db.commit()
    db.refresh(candidate)

    cand_dict = CandidateRead.model_validate(candidate).model_dump()
    if current_user.role != "admin":
        cand_dict["internal_notes"] = None
    return CandidateRead(**cand_dict)

def soft_delete_candidate_service(db: Session, candidate_id: str) -> dict:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    candidate.status = "archived"
    db.commit()
    return {"message": f"Candidate {candidate_id} soft deleted (status set to archived)"}

async def create_score_service(
    db: Session, candidate_id: str, score_in: ScoreCreate, current_user: User
) -> ScoreRead:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    existing_score = db.query(Score).filter(
        Score.candidate_id == candidate_id,
        Score.reviewer_id == current_user.id,
        Score.category == score_in.category
    ).first()

    if existing_score:
        existing_score.score = score_in.score
        existing_score.note = score_in.note
        score_obj = existing_score
    else:
        score_obj = Score(
            candidate_id=candidate_id,
            reviewer_id=current_user.id,
            category=score_in.category,
            score=score_in.score,
            note=score_in.note
        )
        db.add(score_obj)

    db.commit()
    db.refresh(score_obj)

    score_dict = ScoreRead.model_validate(score_obj).model_dump()
    score_dict["reviewer_email"] = current_user.email
    score_read = ScoreRead(**score_dict)

    sse_data = f"data: {score_read.model_dump_json()}\n\n"
    await broadcaster.broadcast(candidate_id, sse_data)

    return score_read

async def generate_ai_summary_service(db: Session, candidate_id: str) -> AISummaryResponse:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    await asyncio.sleep(2)

    scores = db.query(Score).filter(Score.candidate_id == candidate_id).all()
    if scores:
        avg_score = sum(s.score for s in scores) / len(scores)
        categories = list(set(s.category for s in scores))
        summary_text = (
            f"{candidate.name} applied for {candidate.role_applied}. "
            f"Key skills include {candidate.skills or 'N/A'}. "
            f"Based on {len(scores)} evaluation review(s) across categories ({', '.join(categories)}), "
            f"the candidate maintains an average rating of {avg_score:.1f}/5.0. "
            f"Current status is '{candidate.status}'."
        )
    else:
        summary_text = (
            f"{candidate.name} applied for {candidate.role_applied} with skills in {candidate.skills or 'N/A'}. "
            f"No reviewer evaluation scores have been submitted yet. Candidate is currently marked as '{candidate.status}'."
        )

    candidate.ai_summary = summary_text
    db.commit()

    return AISummaryResponse(candidate_id=candidate_id, summary=summary_text)
