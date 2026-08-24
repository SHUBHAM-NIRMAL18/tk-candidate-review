export interface APIKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  is_active: boolean;
}

export interface APIKeyCreatedResponse extends APIKey {
  raw_key: string;
}

export interface APIKeyCreateInput {
  name: string;
  scopes: string[];
  expires_in_days?: number;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  description?: string | null;
  is_active: boolean;
  created_at: string;
  last_triggered_at: string | null;
}

export interface WebhookCreateInput {
  url: string;
  secret?: string;
  events: string[];
  description?: string;
}

export interface WebhookUpdateInput {
  url?: string;
  secret?: string;
  events?: string[];
  description?: string;
  is_active?: boolean;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_name: string;
  payload: string;
  response_status_code: number | null;
  response_body: string | null;
  duration_ms: number | null;
  success: boolean;
  created_at: string;
}

export interface WebhookTestResult {
  success: boolean;
  status_code: number | null;
  response_body: string | null;
  duration_ms: number | null;
  delivery_id?: string;
}
