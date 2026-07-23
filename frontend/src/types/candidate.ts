export interface Score {
  id: string;
  candidate_id: string;
  reviewer_id: string;
  reviewer_email?: string | null;
  category: string;
  score: number;
  note?: string;
  created_at: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  role_applied: string;
  status: 'new' | 'reviewed' | 'hired' | 'rejected' | 'archived';
  skills?: string;
  internal_notes?: string | null;
  ai_summary?: string | null;
  average_score?: number | null;
  created_at: string;
}

export interface CandidateDetail extends Candidate {
  scores: Score[];
}

export interface CandidateListResponse {
  items: Candidate[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface CandidateFilters {
  status?: string;
  role_applied?: string;
  skill?: string;
  keyword?: string;
  page?: number;
  page_size?: number;
}

export interface ScoreSubmission {
  category: string;
  score: number;
  note?: string;
}

export interface CandidateCreateInput {
  name: string;
  email: string;
  role_applied: string;
  status?: string;
  skills?: string;
  internal_notes?: string;
}
