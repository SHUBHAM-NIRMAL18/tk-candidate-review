import { apiFetch } from './client';
import type { AnalyticsResponse } from '../types/analytics';

export async function fetchAnalytics(): Promise<AnalyticsResponse> {
  return apiFetch<AnalyticsResponse>('/api/v1/analytics');
}
