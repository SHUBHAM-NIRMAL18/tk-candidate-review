import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime

def generate_uuid() -> str:
    return str(uuid.uuid4())

class TimestampMixin:
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
