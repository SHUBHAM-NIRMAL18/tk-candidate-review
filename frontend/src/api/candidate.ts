import { apiFetch } from './client';
import type {
  Candidate,
  CandidateDetail,
  CandidateListResponse,
  CandidateFilters,
  CandidateCreateInput,
  ScoreSubmission,
  Score
} from '../types/candidate';

export async function fetchCandidates(filters: CandidateFilters = {}): Promise<CandidateListResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.role_applied) params.append('role_applied', filters.role_applied);
  if (filters.skill) params.append('skill', filters.skill);
  if (filters.keyword) params.append('keyword', filters.keyword);
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.page_size) params.append('page_size', filters.page_size.toString());

  const queryString = params.toString();
  const endpoint = `/api/v1/candidates${queryString ? `?${queryString}` : ''}`;
  return apiFetch<CandidateListResponse>(endpoint);
}

export async function fetchCandidateById(id: string): Promise<CandidateDetail> {
  return apiFetch<CandidateDetail>(`/api/v1/candidates/${id}`);
}

export async function createCandidate(input: CandidateCreateInput): Promise<Candidate> {
  return apiFetch<Candidate>('/api/v1/candidates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function submitScore(candidateId: string, submission: ScoreSubmission): Promise<Score> {
  return apiFetch<Score>(`/api/v1/candidates/${candidateId}/scores`, {
    method: 'POST',
    body: JSON.stringify(submission),
  });
}

export async function generateAISummary(candidateId: string): Promise<{ candidate_id: string; summary: string }> {
  return apiFetch<{ candidate_id: string; summary: string }>(`/api/v1/candidates/${candidateId}/summary`, {
    method: 'POST',
  });
}

export async function softDeleteCandidate(candidateId: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/candidates/${candidateId}`, {
    method: 'DELETE',
  });
}

export async function updateCandidateNotes(candidateId: string, internalNotes: string): Promise<Candidate> {
  return apiFetch<Candidate>(`/api/v1/candidates/${candidateId}`, {
    method: 'PATCH',
    body: JSON.stringify({ internal_notes: internalNotes }),
  });
}

export async function updateCandidateStatus(candidateId: string, status: string): Promise<Candidate> {
  return apiFetch<Candidate>(`/api/v1/candidates/${candidateId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
