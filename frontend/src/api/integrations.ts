import { apiFetch } from './client';
import type {
  APIKey,
  APIKeyCreatedResponse,
  APIKeyCreateInput,
  Webhook,
  WebhookCreateInput,
  WebhookUpdateInput,
  WebhookDelivery,
  WebhookTestResult,
} from '../types/integration';

// API Keys
export async function fetchApiKeys(): Promise<APIKey[]> {
  return apiFetch<APIKey[]>('/api/v1/integrations/api-keys');
}

export async function createApiKey(data: APIKeyCreateInput): Promise<APIKeyCreatedResponse> {
  return apiFetch<APIKeyCreatedResponse>('/api/v1/integrations/api-keys', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function revokeApiKey(keyId: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/integrations/api-keys/${keyId}`, {
    method: 'DELETE',
  });
}

// Webhooks
export async function fetchWebhooks(): Promise<Webhook[]> {
  return apiFetch<Webhook[]>('/api/v1/integrations/webhooks');
}

export async function createWebhook(data: WebhookCreateInput): Promise<Webhook> {
  return apiFetch<Webhook>('/api/v1/integrations/webhooks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateWebhook(id: string, data: WebhookUpdateInput): Promise<Webhook> {
  return apiFetch<Webhook>(`/api/v1/integrations/webhooks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteWebhook(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/integrations/webhooks/${id}`, {
    method: 'DELETE',
  });
}

export async function testWebhook(id: string): Promise<WebhookTestResult> {
  return apiFetch<WebhookTestResult>(`/api/v1/integrations/webhooks/${id}/test`, {
    method: 'POST',
  });
}

export async function fetchWebhookDeliveries(id: string): Promise<WebhookDelivery[]> {
  return apiFetch<WebhookDelivery[]>(`/api/v1/integrations/webhooks/${id}/deliveries`);
}

// Exports
export function getExportCsvUrl(status?: string): string {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return `/api/v1/export/candidates.csv${query}`;
}

export function getExportJsonUrl(status?: string): string {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return `/api/v1/export/candidates.json${query}`;
}
