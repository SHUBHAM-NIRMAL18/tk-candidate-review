import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base, SessionLocal
from app.routers import auth as auth_router
from app.routers import candidates as candidates_router
from app.routers import analytics as analytics_router
from app.routers import integrations as integrations_router
from app.routers import export as export_router
from app.seed import seed_database
from app.metrics import setup_metrics
from app.idempotency import IdempotencyMiddleware
from app.rate_limiter import RateLimitMiddleware

def run_migrations():
    """Runs pending Alembic database migrations on startup with brownfield auto-stamp support."""
    import logging
    logger = logging.getLogger("alembic.runtime")
    try:
        from alembic.config import Config
        from alembic import command
        from sqlalchemy import inspect, text

        base_dir = os.path.dirname(os.path.dirname(__file__))
        ini_path = os.path.join(base_dir, "alembic.ini")
        alembic_cfg = Config(ini_path)
        alembic_cfg.set_main_option("script_location", os.path.join(base_dir, "alembic"))

        # Inspect database: if tables exist from legacy create_all without alembic_version, stamp to baseline
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
        needs_stamp = False
        if "users" in existing_tables:
            if "alembic_version" not in existing_tables:
                needs_stamp = True
            else:
                with engine.connect() as conn:
                    result = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
                    if not result:
                        needs_stamp = True

        if needs_stamp:
            logger.info("Existing database detected without revision tracking. Stamping to baseline 001_initial_schema.")
            command.stamp(alembic_cfg, "001_initial_schema")

        command.upgrade(alembic_cfg, "head")
        logger.info("Database schema migrated to latest Alembic revision.")
    except Exception as exc:
        logger.warning("Automated migration fallback due to: %s. Using metadata create_all.", exc)
        Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title="TechKraft Candidate Review API",
    version="1.0.0",
    lifespan=lifespan
)

cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(candidates_router.router)
app.include_router(analytics_router.router)
app.include_router(integrations_router.router)
app.include_router(export_router.router)

# Initialize Prometheus instrumentation & /metrics route
setup_metrics(app)

# Initialize Idempotency Middleware for safe request retries on mutating endpoints
app.add_middleware(IdempotencyMiddleware)

# Initialize Token Bucket Rate Limiter with RFC standard headers
app.add_middleware(RateLimitMiddleware)

@app.get("/")
def read_root():
    return {"status": "online", "message": "TechKraft Candidate Review API is running"}

