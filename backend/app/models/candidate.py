from sqlalchemy import Column, String, Text
from app.database import Base
from app.models.base import generate_uuid, TimestampMixin

class Candidate(Base, TimestampMixin):
    __tablename__ = "candidates"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, index=True)
    role_applied = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default="new", index=True)
    skills = Column(Text, nullable=True)
    internal_notes = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
