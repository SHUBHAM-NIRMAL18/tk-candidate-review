from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import generate_uuid

class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(String, primary_key=True, default=generate_uuid)
    url = Column(String, nullable=False)
    secret = Column(String, nullable=False)
    events = Column(String, nullable=False, default="candidate.created,candidate.status_changed,score.submitted,summary.generated")
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    last_triggered_at = Column(DateTime, nullable=True)

    deliveries = relationship("WebhookDelivery", back_populates="webhook", cascade="all, delete-orphan", order_by="desc(WebhookDelivery.created_at)")

class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"

    id = Column(String, primary_key=True, default=generate_uuid)
    webhook_id = Column(String, ForeignKey("webhooks.id", ondelete="CASCADE"), nullable=False)
    event_name = Column(String, nullable=False)
    payload = Column(Text, nullable=False)
    response_status_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    success = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    webhook = relationship("Webhook", back_populates="deliveries")
