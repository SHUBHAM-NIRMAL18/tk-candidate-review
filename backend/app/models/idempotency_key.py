from datetime import datetime, timedelta, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime
from app.database import Base
from app.models.base import generate_uuid

class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    id = Column(String, primary_key=True, default=generate_uuid)
    key = Column(String, index=True, nullable=False)
    user_id = Column(String, index=True, nullable=True)
    request_method = Column(String, nullable=False)
    request_path = Column(String, nullable=False)
    request_hash = Column(String, nullable=False)
    response_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    response_headers = Column(Text, nullable=True)  # JSON-encoded header mapping
    status = Column(String, nullable=False, default="PROCESSING")  # PROCESSING, COMPLETED, FAILED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc) + timedelta(hours=24),
        nullable=False
    )
