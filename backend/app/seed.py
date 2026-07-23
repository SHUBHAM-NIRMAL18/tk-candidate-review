from sqlalchemy.orm import Session
from app.models.user import User
from app.models.candidate import Candidate
from app.models.score import Score
from app.auth import hash_password

def seed_database(db: Session):
    admin_user = db.query(User).filter(User.email == "admin@techkraft.com").first()
    if not admin_user:
        admin_user = User(
            email="admin@techkraft.com",
            hashed_password=hash_password("adminpassword"),
            role="admin"
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

    reviewer1 = db.query(User).filter(User.email == "reviewer1@techkraft.com").first()
    if not reviewer1:
        reviewer1 = User(
            email="reviewer1@techkraft.com",
            hashed_password=hash_password("reviewerpassword"),
            role="reviewer"
        )
        db.add(reviewer1)
        db.commit()
        db.refresh(reviewer1)

    reviewer2 = db.query(User).filter(User.email == "reviewer2@techkraft.com").first()
    if not reviewer2:
        reviewer2 = User(
            email="reviewer2@techkraft.com",
            hashed_password=hash_password("reviewerpassword"),
            role="reviewer"
        )
        db.add(reviewer2)
        db.commit()
        db.refresh(reviewer2)

    nepali_candidates = [
        {
            "name": "Ram Sharma",
            "email": "ram.sharma@example.com",
            "role_applied": "Full Stack Engineer",
            "status": "reviewed",
            "skills": "Python, FastAPI, React, PostgreSQL, Docker",
            "internal_notes": "Demonstrated exceptional competence in system design and async API concurrency.",
            "ai_summary": "Ram Sharma applied for Full Stack Engineer. Key skills include Python, FastAPI, React, PostgreSQL, Docker. Based on evaluation reviews, maintains a strong 4.5/5.0 rating."
        },
        {
            "name": "Sita Adhikari",
            "email": "sita.adhikari@example.com",
            "role_applied": "Frontend Engineer",
            "status": "new",
            "skills": "React, TypeScript, Vite, TailwindCSS, State Management",
            "internal_notes": "Impressive portfolio design and clean component modularity. Scheduled for interview."
        },
        {
            "name": "Bikash Gurung",
            "email": "bikash.gurung@example.com",
            "role_applied": "Backend Engineer",
            "status": "hired",
            "skills": "Python, Go, SQLAlchemy, Redis, System Design",
            "internal_notes": "Offer accepted. Joining the engineering team next month."
        },
        {
            "name": "Anjali Thapa",
            "email": "anjali.thapa@example.com",
            "role_applied": "DevOps Lead",
            "status": "rejected",
            "skills": "Docker, Kubernetes, Terraform, AWS, CI/CD",
            "internal_notes": "Salary expectations exceeded position budget."
        },
        {
            "name": "Aayush Shrestha",
            "email": "aayush.shrestha@example.com",
            "role_applied": "Full Stack Engineer",
            "status": "new",
            "skills": "Node.js, React, Express, PostgreSQL, GraphQL",
            "internal_notes": "Strong candidate with solid open-source contributions."
        }
    ]

    for cdata in nepali_candidates:
        existing = db.query(Candidate).filter(Candidate.email == cdata["email"]).first()
        if not existing:
            cand = Candidate(**cdata)
            db.add(cand)
            db.commit()
            db.refresh(cand)

            if cand.email == "ram.sharma@example.com":
                s1 = Score(candidate_id=cand.id, reviewer_id=reviewer1.id, category="System Architecture", score=5, note="Excellent API schema and modular service layer structure.")
                s2 = Score(candidate_id=cand.id, reviewer_id=reviewer2.id, category="Problem Solving", score=4, note="Quickly identified memory consumption bottlenecks.")
                db.add_all([s1, s2])
                db.commit()
