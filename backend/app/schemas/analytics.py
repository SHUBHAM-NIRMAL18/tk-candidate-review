from typing import List, Optional
from pydantic import BaseModel

class KPISummary(BaseModel):
    total_candidates: int
    active_candidates: int
    archived_candidates: int
    total_reviews: int
    average_score: Optional[float] = None
    review_coverage_pct: float

class FunnelStageMetric(BaseModel):
    stage: str
    label: str
    count: int
    percentage: float

class RoleMetric(BaseModel):
    role: str
    candidate_count: int
    average_score: Optional[float] = None
    percentage: float

class CategoryMetric(BaseModel):
    category: str
    average_score: float
    review_count: int

class ScoreDistributionMetric(BaseModel):
    score: int
    count: int
    percentage: float

class SkillMetric(BaseModel):
    skill: str
    count: int

class TopCandidateMetric(BaseModel):
    id: str
    name: str
    role_applied: str
    status: str
    average_score: float
    reviews_count: int

class ReviewerActivityMetric(BaseModel):
    reviewer_id: str
    reviewer_email: str
    reviews_count: int
    average_score_given: Optional[float] = None

class PersonalReviewerStats(BaseModel):
    my_reviews_count: int
    my_candidates_reviewed: int
    my_average_score: Optional[float] = None

class AnalyticsResponse(BaseModel):
    kpis: KPISummary
    funnel: List[FunnelStageMetric]
    roles: List[RoleMetric]
    categories: List[CategoryMetric]
    score_distribution: List[ScoreDistributionMetric]
    top_skills: List[SkillMetric]
    top_candidates: List[TopCandidateMetric]
    reviewer_activity: Optional[List[ReviewerActivityMetric]] = None
    my_stats: Optional[PersonalReviewerStats] = None
