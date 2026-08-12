export interface KPISummary {
  total_candidates: number;
  active_candidates: number;
  archived_candidates: number;
  total_reviews: number;
  average_score: number | null;
  review_coverage_pct: number;
}

export interface FunnelStageMetric {
  stage: string;
  label: string;
  count: number;
  percentage: number;
}

export interface RoleMetric {
  role: string;
  candidate_count: number;
  average_score: number | null;
  percentage: number;
}

export interface CategoryMetric {
  category: string;
  average_score: number;
  review_count: number;
}

export interface ScoreDistributionMetric {
  score: number;
  count: number;
  percentage: number;
}

export interface SkillMetric {
  skill: string;
  count: number;
}

export interface TopCandidateMetric {
  id: string;
  name: string;
  role_applied: string;
  status: string;
  average_score: number;
  reviews_count: number;
}

export interface ReviewerActivityMetric {
  reviewer_id: string;
  reviewer_email: string;
  reviews_count: number;
  average_score_given: number | null;
}

export interface PersonalReviewerStats {
  my_reviews_count: number;
  my_candidates_reviewed: number;
  my_average_score: number | null;
}

export interface AnalyticsResponse {
  kpis: KPISummary;
  funnel: FunnelStageMetric[];
  roles: RoleMetric[];
  categories: CategoryMetric[];
  score_distribution: ScoreDistributionMetric[];
  top_skills: SkillMetric[];
  top_candidates: TopCandidateMetric[];
  reviewer_activity?: ReviewerActivityMetric[] | null;
  my_stats?: PersonalReviewerStats | null;
}
