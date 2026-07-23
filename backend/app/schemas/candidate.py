from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class ScoreBase(BaseModel):
    category: str = Field(..., min_length=1, json_schema_extra={"example": "Technical"})
    score: int = Field(..., ge=1, le=5, json_schema_extra={"example": 4})
    note: Optional[str] = Field(None, json_schema_extra={"example": "Good knowledge of Python async patterns."})

class ScoreCreate(ScoreBase):
    pass

class ScoreRead(ScoreBase):
    id: str
    candidate_id: str
    reviewer_id: str
    reviewer_email: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CandidateBase(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr
    role_applied: str = Field(..., min_length=1)
    status: str = Field("new", pattern="^(new|reviewed|hired|rejected|archived)$")
    skills: Optional[str] = None
    internal_notes: Optional[str] = None

class CandidateCreate(CandidateBase):
    pass

class CandidateUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role_applied: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(new|reviewed|hired|rejected|archived)$")
    skills: Optional[str] = None
    internal_notes: Optional[str] = None

class CandidateRead(BaseModel):
    id: str
    name: str
    email: str
    role_applied: str
    status: str
    skills: Optional[str] = None
    internal_notes: Optional[str] = None
    ai_summary: Optional[str] = None
    average_score: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CandidateDetailRead(CandidateRead):
    scores: List[ScoreRead] = []

class CandidateListResponse(BaseModel):
    items: List[CandidateRead]
    total: int
    page: int
    page_size: int
    pages: int

class AISummaryResponse(BaseModel):
    candidate_id: str
    summary: str
