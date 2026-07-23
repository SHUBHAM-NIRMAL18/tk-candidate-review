# TechKraft Candidate Review Dashboard

An internal candidate evaluation tool built with FastAPI, React (Vite), SQLite/SQLAlchemy, and JWT authentication. Built for the TechKraft Full Stack Engineer take-home assignment.

A quick note on time: the brief gives a 2.5-hour target, but there is no scoring line tied to time itself. I went a bit past it to get RBAC, the SSE stretch goal, and tests done properly rather than submit something half-working. I prioritized correctness over rushing.

---

## Setup & Run Instructions

### Prerequisites
- Docker Desktop (for Windows / macOS) or Docker Engine + Docker Compose (for Linux) installed and running.

### Launch
```bash
docker-compose up --build -d
```

### Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | Candidate dashboard |
| Backend API | http://localhost:8000 | FastAPI REST service |
| Swagger docs | http://localhost:8000/docs | OpenAPI UI |

### Seeded Accounts
The backend seeds a few accounts on first startup (`seed_database()` runs in the FastAPI lifespan hook if tables are empty):

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@techkraft.com | adminpassword |
| Reviewer 1 | reviewer1@techkraft.com | reviewerpassword |
| Reviewer 2 | reviewer2@techkraft.com | reviewerpassword |

### Run Tests
```bash
docker exec tk-candidate-review-backend-1 python -m pytest tests/ -v -W ignore
```

---

## Debugging Signal & Bug Identification

Snippet from the assignment brief:
```python
def search_candidates(status: str, keyword: str, page: int, page_size: int):
    all_candidates = db.execute("SELECT * FROM candidates").fetchall()
    filtered = [c for c in all_candidates if c["status"] == status]
    # ... also filter by keyword in Python ...
    offset = (page - 1) * page_size
    return filtered[offset : offset + page_size]
```

**What is wrong:** It pulls the entire `candidates` table into memory on every call, then does the filtering and pagination in Python. That means every request costs the same regardless of how small a page you asked for, memory usage grows with table size instead of staying flat, and none of the indexes on `status` or `role_applied` ever get used because SQLite or Postgres never sees the filter condition.

**Fix:** Push filtering and pagination directly down into SQL:
```python
def search_candidates(db: Session, status: str = None, keyword: str = None, page: int = 1, page_size: int = 20):
    query = db.query(Candidate)
    if status:
        query = query.filter(Candidate.status == status)
    if keyword:
        kw = f"%{keyword}%"
        query = query.filter(Candidate.name.ilike(kw) | Candidate.email.ilike(kw))

    offset = (page - 1) * page_size
    return query.order_by(Candidate.created_at.desc()).offset(offset).limit(page_size).all()
```

---

## Architecture Decision Record (ADR)

### ADR 1: FastAPI + Pydantic v2 over Django / Express
- **Context:** Needed async support (for the mock LLM call and SSE), automatic request validation, and quick OpenAPI documentation without heavy setup.
- **Decision:** Selected FastAPI with Pydantic v2 for automatic schema parsing, fast async request handling, and clean dependency injection (`Depends`).
- **Trade-off:** Accepted writing manual SQLAlchemy ORM model queries instead of relying on a built-in admin framework like Django.

### ADR 2: Modular React Component Architecture & Fixed Table Layouts
- **Context:** Needed a responsive, clean UI capable of rendering score tables, submission forms, AI summaries, and admin controls across roles without layout horizontal stretching or code bloat.
- **Decision:** Structured the frontend into modular single-responsibility sub-components (`CandidateProfileCard`, `AISummaryCard`, `CandidateScoresCard`, `AdminNotesCard`) with dedicated CSS modules and fixed table layout rules.
- **Trade-off:** Managing separate CSS component stylesheets requires explicit naming, but guarantees predictable flex/grid card sizing, total styling isolation, and zero third-party UI framework bloat.

### ADR 3: JWT in HttpOnly SameSite=Lax Cookies with Server-Side Blacklisting
- **Context:** Authentication required role-based access control (RBAC), secure token storage, and immediate token revocation on logout.
- **Decision:** Stored JWTs in `HttpOnly`, `SameSite=Lax` cookies (protected against XSS attacks) and recorded revoked token IDs (`jti`) in a database `blacklisted_tokens` table on `POST /auth/logout`.
- **Trade-off:** Added a fast indexed database query during authentication checks, accepting minor DB latency for security against stolen JWT reuse.

### ADR 4: In-Memory Async Broadcaster for Real-Time SSE Score Updates
- **Context:** Reviewers needed real-time score stream updates on candidate details without manual page refreshes.
- **Decision:** Built an in-memory `asyncio.Queue` broadcaster exposed via FastAPI `StreamingResponse` (`text/event-stream`).
- **Trade-off:** Provides lightweight real-time capabilities without external infrastructure, though a distributed message broker (such as Redis Pub/Sub) would be required for multi-replica horizontal scaling.

---

## Known Limitations

- Keyword search uses basic `ILIKE` filtering, which works fine for this dataset size but would need full-text search at scale.
- SSE broadcaster is in-memory only, so restarting the backend drops active live streams.
- Frontend styling focuses on a clean, modern UI (Plus Jakarta Sans typography, status pills, interactive modals, responsive mobile cards) while maintaining clear visual hierarchy.
- Test suite is split into modular Pytest modules (`test_auth.py`, `test_candidates.py`, `test_scores.py`) covering registration role hardcoding, password strength, score isolation, token blacklisting on logout, and admin soft delete.
- Login rate limiting is not included yet, though adding `slowapi` middleware would handle that easily.

---

## Learning Reflection

This was my first time wiring up Server-Sent Events with FastAPI end to end. The tricky part was not the streaming itself, but cleaning up the queue properly when a client disconnects so it does not leak memory. Given more time, I would swap the in-memory broadcaster for Redis Pub/Sub so it would survive server restarts and work across multiple backend instances.

---

## AI Tool Use

Used Claude to help generate repetitive boilerplate (Pydantic schemas, Dockerfiles, and standard CRUD routes) and to double-check the SSE cleanup logic. Wrote and verified the RBAC enforcement, soft-delete logic, and the SQL pagination fix by hand since those were the core technical requirements of the assignment.

---

## Example API Calls

### 1. User Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "reviewer1@techkraft.com", "password": "reviewerpassword"}' \
  -c cookies.txt
```

### 2. List Candidates (filtered + paginated)
```bash
curl -X GET "http://localhost:8000/api/v1/candidates?status=reviewed&page=1&page_size=10" \
  -b cookies.txt
```

### 3. Submit Evaluation Score
```bash
curl -X POST http://localhost:8000/api/v1/candidates/CANDIDATE_ID/scores \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"category": "System Architecture", "score": 5, "note": "Demonstrated strong API concurrency patterns."}'
```

### 4. Trigger AI Summary
```bash
curl -X POST http://localhost:8000/api/v1/candidates/CANDIDATE_ID/summary \
  -b cookies.txt
```

### 5. Archive Candidate (soft delete, admin only)
```bash
curl -X DELETE http://localhost:8000/api/v1/candidates/CANDIDATE_ID \
  -b cookies.txt
```

---

## Security Notes

- `POST /auth/register` always sets `role="reviewer"` server-side. Any `role` field sent by the client is ignored and never trusted.
- Reviewers receive `internal_notes: null` in API responses and only ever see their own scores, enforced in the database query layer rather than just the UI.
- Deleting a candidate sets `status = "archived"`. There is no code path that runs a hard `DELETE FROM candidates`.
- `.env` is included in `.gitignore`, and `.env.example` provides placeholder values only.
