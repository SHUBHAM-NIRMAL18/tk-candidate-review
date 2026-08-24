import io
import csv
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models.candidate import Candidate
from app.models.score import Score
from app.models.user import User

def generate_candidates_csv(
    db: Session,
    current_user: User,
    status_filter: Optional[str] = None
) -> str:
    """Generates a CSV string of candidates, their aggregated scores, and review statuses."""
    query = db.query(Candidate)
    if status_filter:
        query = query.filter(Candidate.status == status_filter)
    else:
        query = query.filter(Candidate.status != "archived")

    candidates = query.order_by(Candidate.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    headers = [
        "Candidate ID",
        "Name",
        "Email",
        "Role Applied",
        "Status",
        "Skills",
        "Average Score",
        "Total Reviews",
        "AI Summary",
        "Created At"
    ]
    if current_user.role == "admin":
        headers.insert(6, "Internal Notes")

    writer.writerow(headers)

    for c in candidates:
        scores = db.query(Score.score).filter(Score.candidate_id == c.id).all()
        if scores:
            avg_score = f"{sum(s[0] for s in scores) / len(scores):.1f}"
            total_reviews = str(len(scores))
        else:
            avg_score = "N/A"
            total_reviews = "0"

        row = [
            c.id,
            c.name,
            c.email,
            c.role_applied,
            c.status,
            c.skills or "",
            avg_score,
            total_reviews,
            c.ai_summary or "",
            c.created_at.strftime("%Y-%m-%d %H:%M:%S") if c.created_at else ""
        ]
        if current_user.role == "admin":
            row.insert(6, c.internal_notes or "")

        writer.writerow(row)

    return output.getvalue()

def generate_candidates_json(
    db: Session,
    current_user: User,
    status_filter: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Generates a structured list of candidates and nested evaluation scores for external ETL pipelines."""
    query = db.query(Candidate)
    if status_filter:
        query = query.filter(Candidate.status == status_filter)
    else:
        query = query.filter(Candidate.status != "archived")

    candidates = query.order_by(Candidate.created_at.desc()).all()
    results = []

    for c in candidates:
        scores = db.query(Score, User.email).outerjoin(User, Score.reviewer_id == User.id).filter(Score.candidate_id == c.id).all()
        
        score_list = []
        for s_obj, u_email in scores:
            # Non-admin reviewers only see their own scores
            if current_user.role != "admin" and s_obj.reviewer_id != current_user.id:
                continue
            score_list.append({
                "id": s_obj.id,
                "category": s_obj.category,
                "score": s_obj.score,
                "note": s_obj.note,
                "reviewer_email": u_email,
                "created_at": s_obj.created_at.isoformat() if s_obj.created_at else None
            })

        all_scores = [s_obj.score for s_obj, _ in scores]
        avg_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else None

        cand_data = {
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "role_applied": c.role_applied,
            "status": c.status,
            "skills": c.skills,
            "average_score": avg_score,
            "total_reviews": len(all_scores),
            "ai_summary": c.ai_summary,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "scores": score_list
        }
        if current_user.role == "admin":
            cand_data["internal_notes"] = c.internal_notes

        results.append(cand_data)

    return results
