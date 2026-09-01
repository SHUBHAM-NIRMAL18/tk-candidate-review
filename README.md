# Candidate Review Dashboard

An internal candidate evaluation tool built with FastAPI, React (Vite), SQLite/SQLAlchemy, and JWT authentication. Built for the Full Stack Engineer take-home assignment.

A quick note on time: the brief gives a 2.5-hour target, but there is no scoring line tied to time itself. I went a bit past it to get RBAC, the SSE stretch goal, and tests done properly rather than submit something half-working. I prioritized correctness over rushing.

---

## Setup & Run Instructions

### Prerequisites
- Docker Desktop (for Windows / macOS) or Docker Engine + Docker Compose (for Linux) installed and running.
- Git installed on your system.

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/SHUBHAM-NIRMAL18/tk-candidate-review.git
   ```

2. **Navigate into the project directory:**
   ```bash
   cd tk-candidate-review
   ```

3. **Launch the application with Docker:**
   ```bash
   docker-compose up --build -d
   ```
   *(or `docker compose up --build -d` depending on your Docker setup)*

### Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | Candidate review web UI |
| Backend API | http://localhost:8000 | FastAPI REST service |
| Swagger docs | http://localhost:8000/docs | Interactive OpenAPI documentation |
| Prometheus | http://localhost:9090 | Prometheus metrics server & query engine |
| Alertmanager | http://localhost:9093 | Alert routing, silencing & severity-based notification |
| Grafana Dashboard | http://localhost:3000 | Pre-provisioned Candidate Review Observability dashboard (`admin`/`admin`) |
| Metrics Endpoint | http://localhost:8000/metrics | Prometheus raw metrics exposition |

### Seeded Accounts
The backend seeds a few accounts on first startup (`seed_database()` runs in the FastAPI lifespan hook if tables are empty):

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | adminpassword |
| Reviewer 1 | reviewer1@example.com | reviewerpassword |
| Reviewer 2 | reviewer2@example.com | reviewerpassword |

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

**Fix:** Push filtering, dynamic sorting, and pagination directly down into SQL:
```python
def search_candidates(db: Session, status: str = None, keyword: str = None, sort_by: str = None, sort_order: str = "desc", page: int = 1, page_size: int = 20):
    query = db.query(Candidate)
    if status:
        query = query.filter(Candidate.status == status)
    if keyword:
        kw = f"%{keyword}%"
        query = query.filter(Candidate.name.ilike(kw) | Candidate.email.ilike(kw))

    # Dynamic SQL-level sorting (handles average_score via outer join & coalesced score aggregation)
    if sort_by == "average_score":
        avg_expr = func.coalesce(func.avg(Score.score), -1)
        query = query.outerjoin(Score, Candidate.id == Score.candidate_id).group_by(Candidate.id)
        query = query.order_by(avg_expr.asc() if sort_order == "asc" else avg_expr.desc())
    elif sort_by in ("name", "role_applied", "status", "created_at"):
        col = getattr(Candidate, sort_by)
        query = query.order_by(col.asc() if sort_order == "asc" else col.desc())
    else:
        query = query.order_by(Candidate.created_at.desc())

    offset = (page - 1) * page_size
    return query.offset(offset).limit(page_size).all()
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
  -d '{"email": "reviewer1@example.com", "password": "reviewerpassword"}' \
  -c cookies.txt
```

### 2. List Candidates (filtered, sorted + paginated)
```bash
curl -X GET "http://localhost:8000/api/v1/candidates?status=reviewed&sort_by=average_score&sort_order=desc&page=1&page_size=10" \
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

### 6. Get Hiring & Evaluation Analytics
```bash
curl -X GET http://localhost:8000/api/v1/analytics \
  -b cookies.txt
```

### 7. Machine-to-Machine Auth via API Key (M2M)
```bash
# Query candidates without session cookies using X-API-Key header
curl -X GET "http://localhost:8000/api/v1/candidates" \
  -H "X-API-Key: tk_live_YOUR_API_KEY_HERE"
```

### 8. Export Candidates (CSV & JSON ETL Sync)
```bash
# Download CSV spreadsheet
curl -X GET "http://localhost:8000/api/v1/export/candidates.csv?status=reviewed" \
  -H "X-API-Key: tk_live_YOUR_API_KEY_HERE" \
  -o candidates_export.csv

# Fetch full JSON dataset for ETL pipelines
curl -X GET "http://localhost:8000/api/v1/export/candidates.json" \
  -H "X-API-Key: tk_live_YOUR_API_KEY_HERE"
```

### 9. Register Outbound Webhook (Admin)
```bash
curl -X POST "http://localhost:8000/api/v1/integrations/webhooks" \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.mycompany.com/webhooks/candidate-events",
    "events": ["candidate.created", "candidate.status_changed", "score.submitted", "summary.generated"],
    "description": "Slack Alert & ATS Sync"
  }'
```

---

## Security Notes

- `POST /auth/register` always sets `role="reviewer"` server-side. Any `role` field sent by the client is ignored and never trusted.
- Reviewers receive `internal_notes: null` in API responses and only ever see their own scores, enforced in the database query layer rather than just the UI.
- **Archiving & Soft Delete RBAC**:
  - **Backend Layer**: Candidate soft delete (`DELETE /api/v1/candidates/{id}`) and profile updates (`PATCH /api/v1/candidates/{id}`) are guarded with `Depends(require_role(["admin"]))`. Any non-admin reviewer attempt returns HTTP `403 Forbidden`.
  - **Frontend UI Guardrail**: The **Archive Candidate** buttons (desktop table and mobile cards) are conditionally rendered (`isAdmin`) exclusively for admin users, preventing unauthorized reviewer interaction.
  - **Data Retention**: Deleting a candidate sets `status = "archived"`. There is no code path that executes a hard SQL `DELETE FROM candidates`.
- `.env` is included in `.gitignore`, and `.env.example` provides placeholder values only.

---

## Monitoring & Observability (Prometheus + Grafana + Alertmanager)

The stack comes fully instrumented with a production-grade observability pipeline — **Prometheus** metrics collection, **Alertmanager** severity-based alert routing, and **Grafana** visualization with **zero manual setup** required. Everything is infrastructure-as-code: dashboards, data sources, alert rules, and recording rules are auto-provisioned on `docker compose up`.

### Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Grafana Dashboard | http://localhost:3000 | Pre-provisioned observability dashboard (`admin`/`admin` or anonymous) |
| Prometheus | http://localhost:9090 | PromQL query engine & alert rule evaluation |
| Prometheus Targets | http://localhost:9090/targets | Scrape target health status |
| Prometheus Alerts | http://localhost:9090/alerts | Active/pending/resolved alert rules |
| Prometheus Rules | http://localhost:9090/rules | Recording & alerting rule evaluation status |
| Alertmanager | http://localhost:9093 | Alert routing, silencing & inhibition UI |
| Raw Metrics | http://localhost:8000/metrics | Prometheus exposition format endpoint |

---

### 1. Alerting Pipeline (Prometheus → Alertmanager → Webhooks)

Metrics alone are dashboards nobody watches. The stack includes a full alerting pipeline:

```
Backend → Prometheus (scrape) → Alert Rules (evaluate) → Alertmanager (route) → Webhook/Slack
```

**10 Alert Rules** across service health, performance, security, and SLO compliance:

| Alert | Severity | Fires When |
|-------|----------|------------|
| `BackendDown` | 🔴 Critical | Scrape target unreachable for 30s |
| `HighErrorRate` | 🔴 Critical | 5xx rate > 5% for 2 min |
| `CriticalLatencyP99` | 🔴 Critical | p99 > 2.5s for 5 min |
| `SLOErrorBudgetBurnRateHigh` | 🔴 Critical | Error budget burning at 14.4x rate (Google SRE multi-burn-rate pattern) |
| `HighLatencyP99` | 🟡 Warning | p99 > 1s for 5 min |
| `ElevatedClientErrorRate` | 🟡 Warning | 4xx rate > 25% for 5 min |
| `HighInFlightRequests` | 🟡 Warning | Concurrent requests > 50 for 2 min |
| `WebhookDeliveryFailures` | 🟡 Warning | Sustained webhook delivery failures |
| `HighDatabaseLatency` | 🟡 Warning | DB p95 query latency > 500ms for 3 min |
| `HighLoginFailureRate` | 🟡 Warning | Login failure rate > 50% for 5 min (brute-force detection) |

**Alertmanager Configuration:**
- **Severity-based routing**: Critical alerts → immediate channel (10s group wait), warnings → standard channel (30s group wait).
- **Inhibition rules**: If `BackendDown` fires, all other alerts for the same service are suppressed (symptom deduplication). If any critical alert fires, corresponding warnings are inhibited.
- **Receivers**: Configured with webhook receivers (swap to Slack/PagerDuty endpoints for production).

---

### 2. Recording Rules (Query Performance Optimization)

Pre-computed PromQL expressions that avoid expensive re-computation on every dashboard refresh and alert evaluation cycle. This is a standard Prometheus best practice for operating at scale.

| Recording Rule | What It Pre-Computes |
|----------------|---------------------|
| `job:http_requests:rate1m` | Total request rate |
| `job:http_requests_by_status:rate1m` | Request rate by HTTP status code |
| `job:http_request_errors:rate1m` | 5xx error rate |
| `job:http_request_duration_seconds:p50_1m` | Pre-computed p50 latency |
| `job:http_request_duration_seconds:p90_1m` | Pre-computed p90 latency |
| `job:http_request_duration_seconds:p99_1m` | Pre-computed p99 latency |
| `job:slo_availability:ratio1m` | Real-time SLO availability ratio |
| `job:slo_error_budget_remaining:ratio1m` | Error budget burn tracking |
| `job:db_query_duration_seconds:p50_1m` | Database p50 query latency |
| `job:db_query_duration_seconds:p95_1m` | Database p95 query latency |
| `job:auth_login_success:rate5m` | Login success rate |
| `job:auth_login_failure:rate5m` | Login failure rate |

Dashboard panels reference these recording rules instead of raw metrics, reducing Prometheus query load.

---

### 3. SLO & Error Budget Tracking

The dashboard includes an **SLO Tracking & Error Budget** section following Google SRE best practices:

- **SLO Target**: 99.9% availability (0.1% error budget over a 30-day window).
- **SLO Availability Gauge**: Real-time success ratio (`1 - error_rate`) with threshold coloring.
- **Error Budget Remaining Gauge**: Shows what fraction of the monthly error budget has been consumed.
- **Availability vs Target Time Series**: Plots availability ratio over time with the 99.9% target line overlaid for visual SLO breach detection.
- **Multi-Burn-Rate Alert**: The `SLOErrorBudgetBurnRateHigh` alert fires when errors are consuming the budget at 14.4x the sustainable rate (meaning the 30-day budget would be exhausted in ~2 days).

---

### 4. Custom Metrics Catalogue

#### HTTP & API Telemetry
| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `http_requests_total` | Counter | method, handler, status | Total request count by endpoint |
| `http_request_duration_seconds` | Histogram | method, handler, status | Latency distribution (p50/p90/p99) |
| `fastapi_inprogress_requests` | Gauge | method, handler | Concurrent in-flight requests |
| `http_request_size_bytes` | Histogram | method, handler | Request payload size distribution |
| `http_response_size_bytes` | Histogram | method, handler | Response payload size distribution |

#### Database & Infrastructure
| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `db_query_duration_seconds` | Histogram | operation | SQLAlchemy query latency by operation |
| `app_info` | Info | name, version, python_version, framework | Service metadata for discovery |

#### Authentication & Security
| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `auth_login_attempts_total` | Counter | result (success/failure) | Login attempt tracking & brute-force detection |
| `auth_active_sessions` | Gauge | — | Concurrent authenticated session count |

#### Business & Application
| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `candidate_status_updates_total` | Counter | status | Candidate workflow state transitions |
| `candidate_scores_total` | Counter | category | Evaluation scores by review category |
| `webhook_dispatches_total` | Counter | event_name, status | Webhook delivery success/failure tracking |
| `export_requests_total` | Counter | format | Data export operations (CSV vs JSON) |
| `active_sse_connections` | Gauge | — | Live SSE streaming client count |

---

### 5. Grafana Dashboard Sections

The auto-provisioned dashboard (`TechKraft Candidate Review - Observability Dashboard`) contains **5 organized sections** with **22 panels**:

1. **Application Health & KPIs** — Backend status, total requests, throughput, avg latency, error rate, SSE connections
2. **API Request Traffic & Performance** — Throughput by endpoint, HTTP status breakdown, p50/p90/p99 latency, in-flight gauge
3. **Candidate Review Pipeline & Business Analytics** — Status updates pie chart, scores by category, webhook deliveries, export formats, scrape duration
4. **SLO Tracking & Error Budget** — SLO availability gauge, error budget remaining, availability vs target time series
5. **Infrastructure & Security Monitoring** — DB query latency (p50/p95/p99), login activity (success vs failure), request/response payload sizes, active sessions, DB queries by operation

---

### 6. Example PromQL Queries

```promql
# Average API latency (ms) over 1m window using recording rule
job:http_request_duration_seconds:p50_1m * 1000

# Requests per second by route (pre-aggregated)
job:http_requests_by_handler:rate1m

# Current SLO availability (from recording rule)
job:slo_availability:ratio1m{job="candidate-review-backend"}

# Error budget burn rate (how fast are we consuming the monthly budget?)
(1 - job:slo_availability:ratio1m) / 0.001

# Webhook delivery failure rate
sum(rate(webhook_dispatches_total{status="failed"}[5m]))

# Database p95 query latency by operation
histogram_quantile(0.95, sum by (le, operation) (rate(db_query_duration_seconds_bucket[5m])))

# Login failure ratio (brute-force detection signal)
job:auth_login_failure:rate5m / (job:auth_login_success:rate5m + job:auth_login_failure:rate5m)

# Top 5 slowest API endpoints by p99 latency
topk(5, histogram_quantile(0.99, sum by (le, handler) (rate(http_request_duration_seconds_bucket[5m]))))

# Request body size anomaly detection (p95 > 100KB)
histogram_quantile(0.95, sum by (le) (rate(http_request_size_bytes_bucket[5m]))) > 102400
```

### 7. Infrastructure-as-Code (IaC) Summary

Every monitoring component is version-controlled and auto-provisioned — no manual Grafana UI clicks:

| Component | Config File | Provisioning Method |
|-----------|-------------|-------------------|
| Prometheus scrape config | `monitoring/prometheus/prometheus.yml` | Mounted as read-only volume |
| Alerting rules | `monitoring/prometheus/alert_rules.yml` | Loaded via `rule_files` directive |
| Recording rules | `monitoring/prometheus/recording_rules.yml` | Loaded via `rule_files` directive |
| Alertmanager routing | `monitoring/alertmanager/alertmanager.yml` | Mounted as read-only volume |
| Grafana data source | `monitoring/grafana/provisioning/datasources/prometheus.yml` | Grafana provisioning API |
| Grafana dashboard | `monitoring/grafana/dashboards/candidate_review_overview.json` | Grafana file provisioner |
| Grafana alert rules | `monitoring/grafana/provisioning/alerting/alerts.yml` | Grafana unified alerting provisioner |

