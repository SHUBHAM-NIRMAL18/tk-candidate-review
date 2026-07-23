from sqlalchemy import Column, String, DateTime
from app.database import Base
from app.models.base import generate_uuid


class BlacklistedToken(Base):
    """Stores revoked JWT token IDs (jti) to enforce logout invalidation."""
    __tablename__ = "blacklisted_tokens"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    jti = Column(String(36), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
