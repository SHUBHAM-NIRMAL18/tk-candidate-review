from sqlalchemy import Column, String, Text, Integer, ForeignKey
from app.database import Base
from app.models.base import generate_uuid, TimestampMixin

class Score(Base, TimestampMixin):
    __tablename__ = "scores"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False, index=True)
    reviewer_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String, nullable=False)
    score = Column(Integer, nullable=False)
    note = Column(Text, nullable=True)
