import collections
from typing import List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.models.score import Score
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsResponse,
    KPISummary,
    FunnelStageMetric,
    RoleMetric,
    CategoryMetric,
    ScoreDistributionMetric,
    SkillMetric,
    TopCandidateMetric,
    ReviewerActivityMetric,
    PersonalReviewerStats,
)

def get_analytics_service(db: Session, current_user: User) -> AnalyticsResponse:
    # 1. High-level KPIs
    total_candidates = db.query(Candidate).count()
    active_candidates = db.query(Candidate).filter(Candidate.status != "archived").count()
    archived_candidates = db.query(Candidate).filter(Candidate.status == "archived").count()

    total_reviews = db.query(Score).count()
    global_avg_score = db.query(func.avg(Score.score)).scalar()
    average_score = round(float(global_avg_score), 2) if global_avg_score is not None else None

    # Review coverage: active candidates with >= 1 review
    reviewed_active_count = (
        db.query(Score.candidate_id)
        .join(Candidate, Score.candidate_id == Candidate.id)
        .filter(Candidate.status != "archived")
        .distinct()
        .count()
    )
    review_coverage_pct = (
        round((reviewed_active_count / active_candidates) * 100, 1)
        if active_candidates > 0
        else 0.0
    )

    kpis = KPISummary(
        total_candidates=total_candidates,
        active_candidates=active_candidates,
        archived_candidates=archived_candidates,
        total_reviews=total_reviews,
        average_score=average_score,
        review_coverage_pct=review_coverage_pct,
    )

    # 2. Hiring Funnel Stages
    stage_labels = {
        "new": "Applied",
        "reviewed": "Under Review",
        "hired": "Hired",
        "rejected": "Rejected",
        "archived": "Archived",
    }
    status_counts_raw = (
        db.query(Candidate.status, func.count(Candidate.id))
        .group_by(Candidate.status)
        .all()
    )
    status_counts_map = {st: count for st, count in status_counts_raw}

    funnel: List[FunnelStageMetric] = []
    for stage_key, stage_label in stage_labels.items():
        count = status_counts_map.get(stage_key, 0)
        pct = round((count / total_candidates) * 100, 1) if total_candidates > 0 else 0.0
        funnel.append(
            FunnelStageMetric(
                stage=stage_key,
                label=stage_label,
                count=count,
                percentage=pct,
            )
        )

    # 3. Role Breakdown (Active Candidates)
    roles_raw = (
        db.query(
            Candidate.role_applied,
            func.count(Candidate.id.distinct()),
            func.avg(Score.score)
        )
        .outerjoin(Score, Candidate.id == Score.candidate_id)
        .filter(Candidate.status != "archived")
        .group_by(Candidate.role_applied)
        .order_by(func.count(Candidate.id.distinct()).desc())
        .all()
    )
    roles: List[RoleMetric] = []
    for role_name, cand_count, role_avg in roles_raw:
        pct = round((cand_count / active_candidates) * 100, 1) if active_candidates > 0 else 0.0
        roles.append(
            RoleMetric(
                role=role_name,
                candidate_count=cand_count,
                average_score=round(float(role_avg), 2) if role_avg is not None else None,
                percentage=pct,
            )
        )

    # 4. Evaluation Category Benchmarks
    cat_raw = (
        db.query(Score.category, func.avg(Score.score), func.count(Score.id))
        .group_by(Score.category)
        .order_by(func.avg(Score.score).desc())
        .all()
    )
    categories: List[CategoryMetric] = [
        CategoryMetric(
            category=cat_name,
            average_score=round(float(cat_avg), 2),
            review_count=cat_cnt,
        )
        for cat_name, cat_avg, cat_cnt in cat_raw
    ]

    # 5. Score Distribution (1 - 5 stars)
    score_counts_raw = (
        db.query(Score.score, func.count(Score.id))
        .group_by(Score.score)
        .all()
    )
    score_map = {s: cnt for s, cnt in score_counts_raw}
    score_distribution: List[ScoreDistributionMetric] = []
    for s_val in range(1, 6):
        cnt = score_map.get(s_val, 0)
        pct = round((cnt / total_reviews) * 100, 1) if total_reviews > 0 else 0.0
        score_distribution.append(
            ScoreDistributionMetric(
                score=s_val,
                count=cnt,
                percentage=pct,
            )
        )

    # 6. Top In-Demand Skills
    skills_rows = (
        db.query(Candidate.skills)
        .filter(Candidate.status != "archived", Candidate.skills.isnot(None))
        .all()
    )
    skill_counter = collections.Counter()
    for (skills_text,) in skills_rows:
        if skills_text:
            for item in skills_text.split(","):
                cleaned = item.strip()
                if cleaned:
                    skill_counter[cleaned] += 1

    top_skills: List[SkillMetric] = [
        SkillMetric(skill=skill_name, count=count)
        for skill_name, count in skill_counter.most_common(12)
    ]

    # 7. Top Rated Candidates Leaderboard (Active, with reviews)
    top_cand_raw = (
        db.query(
            Candidate.id,
            Candidate.name,
            Candidate.role_applied,
            Candidate.status,
            func.avg(Score.score).label("avg_score"),
            func.count(Score.id).label("score_count"),
        )
        .join(Score, Candidate.id == Score.candidate_id)
        .filter(Candidate.status != "archived")
        .group_by(Candidate.id)
        .order_by(func.avg(Score.score).desc(), func.count(Score.id).desc())
        .limit(5)
        .all()
    )
    top_candidates: List[TopCandidateMetric] = [
        TopCandidateMetric(
            id=cid,
            name=cname,
            role_applied=crole,
            status=cstatus,
            average_score=round(float(cavg), 2),
            reviews_count=ccnt,
        )
        for cid, cname, crole, cstatus, cavg, ccnt in top_cand_raw
    ]

    # 8. Reviewer Contribution & Activity (RBAC projection)
    reviewer_activity: Optional[List[ReviewerActivityMetric]] = None
    if current_user.role == "admin":
        rev_raw = (
            db.query(
                User.id,
                User.email,
                func.count(Score.id),
                func.avg(Score.score)
            )
            .join(Score, User.id == Score.reviewer_id)
            .group_by(User.id)
            .order_by(func.count(Score.id).desc())
            .all()
        )
        reviewer_activity = [
            ReviewerActivityMetric(
                reviewer_id=uid,
                reviewer_email=uemail,
                reviews_count=rcnt,
                average_score_given=round(float(ravg), 2) if ravg is not None else None,
            )
            for uid, uemail, rcnt, ravg in rev_raw
        ]

    # Personal Reviewer Stats (for current user)
    my_scores = db.query(Score).filter(Score.reviewer_id == current_user.id).all()
    my_reviews_count = len(my_scores)
    my_candidates_reviewed = len(set(s.candidate_id for s in my_scores))
    my_avg_score = (
        round(sum(s.score for s in my_scores) / my_reviews_count, 2)
        if my_reviews_count > 0
        else None
    )

    my_stats = PersonalReviewerStats(
        my_reviews_count=my_reviews_count,
        my_candidates_reviewed=my_candidates_reviewed,
        my_average_score=my_avg_score,
    )

    return AnalyticsResponse(
        kpis=kpis,
        funnel=funnel,
        roles=roles,
        categories=categories,
        score_distribution=score_distribution,
        top_skills=top_skills,
        top_candidates=top_candidates,
        reviewer_activity=reviewer_activity,
        my_stats=my_stats,
    )
