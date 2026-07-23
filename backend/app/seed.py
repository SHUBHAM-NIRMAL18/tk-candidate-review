from sqlalchemy.orm import Session
from app.models.user import User
from app.models.candidate import Candidate
from app.models.score import Score
from app.auth import hash_password

def seed_database(db: Session):
    if db.query(User).first():
        return

    admin_user = User(
        email="admin@techkraft.com",
        hashed_password=hash_password("adminpassword"),
        role="admin"
    )
    reviewer1 = User(
        email="reviewer1@techkraft.com",
        hashed_password=hash_password("reviewerpassword"),
        role="reviewer"
    )
    reviewer2 = User(
        email="reviewer2@techkraft.com",
        hashed_password=hash_password("reviewerpassword"),
        role="reviewer"
    )

    db.add_all([admin_user, reviewer1, reviewer2])
    db.commit()
    db.refresh(admin_user)
    db.refresh(reviewer1)
    db.refresh(reviewer2)

    cand1 = Candidate(
        name="Alex Rivera",
        email="alex.rivera@example.com",
        role_applied="Full Stack Engineer",
        status="reviewed",
        skills="Python, FastAPI, React, PostgreSQL, Docker",
        internal_notes="Candidate demonstrated strong knowledge of async concurrency and clean API architecture.",
        ai_summary="Alex Rivera applied for Full Stack Engineer. Key skills include Python, FastAPI, React, PostgreSQL, Docker. Based on evaluation reviews, maintains a strong rating."
    )
    cand2 = Candidate(
        name="Sophia Chen",
        email="sophia.chen@example.com",
        role_applied="Frontend Engineer",
        status="new",
        skills="React, TypeScript, Vite, CSS, State Management",
        internal_notes="Impressive portfolio design. Scheduled for technical interview next week."
    )
    cand3 = Candidate(
        name="Marcus Vance",
        email="marcus.vance@example.com",
        role_applied="Backend Engineer",
        status="hired",
        skills="Python, Go, SQLAlchemy, Redis, System Design",
        internal_notes="Offer accepted. Starting next month."
    )
    cand4 = Candidate(
        name="Elena Rostova",
        email="elena.rostova@example.com",
        role_applied="DevOps Lead",
        status="rejected",
        skills="Docker, Kubernetes, Terraform, AWS, CI/CD",
        internal_notes="Lacked required hands-on experience in high-throughput streaming systems."
    )

    db.add_all([cand1, cand2, cand3, cand4])
    db.commit()
    db.refresh(cand1)
    db.refresh(cand2)

    score1 = Score(
        candidate_id=cand1.id,
        reviewer_id=reviewer1.id,
        category="System Architecture",
        score=5,
        note="Excellent API schema and modular service layer structure."
    )
    score2 = Score(
        candidate_id=cand1.id,
        reviewer_id=reviewer1.id,
        category="Code Quality",
        score=4,
        note="Clean typing and error handling throughout."
    )
    score3 = Score(
        candidate_id=cand1.id,
        reviewer_id=reviewer2.id,
        category="Problem Solving",
        score=5,
        note="Quickly identified memory consumption bottlenecks."
    )
    score4 = Score(
        candidate_id=cand2.id,
        reviewer_id=reviewer2.id,
        category="UI/UX Design",
        score=4,
        note="Solid component modularity and responsive styling."
    )

    db.add_all([score1, score2, score3, score4])
    db.commit()
