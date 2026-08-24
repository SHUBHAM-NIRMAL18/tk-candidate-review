import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  KeyRound,
  Webhook as WebhookIcon,
  Download,
  Plus,
  Trash2,
  Copy,
  Check,
  Send,
  FileText,
  Code2,
  RefreshCw,
  Activity,
} from 'lucide-react';
import {
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
  fetchWebhooks,
  createWebhook,
  deleteWebhook,
  testWebhook,
  fetchWebhookDeliveries,
  getExportCsvUrl,
  getExportJsonUrl,
} from '../api/integrations';
import type {
  APIKey,
  APIKeyCreatedResponse,
  Webhook,
  WebhookDelivery,
} from '../types/integration';
import '../styles/IntegrationsModal.css';

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IntegrationsModal: React.FC<IntegrationsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'api-keys' | 'webhooks' | 'export'>('api-keys');

  // API Keys state
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [showCreateKeyForm, setShowCreateKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'candidates:read',
    'scores:read',
  ]);
  const [expiresDays, setExpiresDays] = useState<number | undefined>(undefined);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<APIKeyCreatedResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isSubmittingKey, setIsSubmittingKey] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [showCreateWebhookForm, setShowCreateWebhookForm] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookDesc, setWebhookDesc] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'candidate.created',
    'candidate.status_changed',
    'score.submitted',
    'summary.generated',
  ]);
  const [isSubmittingWebhook, setIsSubmittingWebhook] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; msg: string } | null>(null);

  // Webhook deliveries log state
  const [selectedWebhookForLogs, setSelectedWebhookForLogs] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  // Export state
  const [exportStatusFilter, setExportStatusFilter] = useState('');

  // General error / notice
  const [actionError, setActionError] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    try {
      setLoadingKeys(true);
      const data = await fetchApiKeys();
      setApiKeys(data);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to fetch API keys');
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  const loadWebhooks = useCallback(async () => {
    try {
      setLoadingWebhooks(true);
      const data = await fetchWebhooks();
      setWebhooks(data);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to fetch webhooks');
    } finally {
      setLoadingWebhooks(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActionError(null);
      if (activeTab === 'api-keys') loadKeys();
      if (activeTab === 'webhooks') loadWebhooks();
    }
  }, [isOpen, activeTab, loadKeys, loadWebhooks]);

  if (!isOpen) return null;

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    try {
      setIsSubmittingKey(true);
      setActionError(null);
      const res = await createApiKey({
        name: newKeyName.trim(),
        scopes: selectedScopes,
        expires_in_days: expiresDays,
      });
      setNewlyCreatedKey(res);
      setShowCreateKeyForm(false);
      setNewKeyName('');
      loadKeys();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsSubmittingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this API key? Systems using it will lose access immediately.')) {
      return;
    }
    try {
      await revokeApiKey(id);
      loadKeys();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to revoke API key');
    }
  };

  const handleCopyKey = () => {
    if (newlyCreatedKey?.raw_key) {
      navigator.clipboard.writeText(newlyCreatedKey.raw_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim() || selectedEvents.length === 0) return;
    try {
      setIsSubmittingWebhook(true);
      setActionError(null);
      await createWebhook({
        url: webhookUrl.trim(),
        secret: webhookSecret.trim() || undefined,
        events: selectedEvents,
        description: webhookDesc.trim() || undefined,
      });
      setShowCreateWebhookForm(false);
      setWebhookUrl('');
      setWebhookSecret('');
      setWebhookDesc('');
      loadWebhooks();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to register webhook');
    } finally {
      setIsSubmittingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this webhook subscription?')) return;
    try {
      await deleteWebhook(id);
      loadWebhooks();
      if (selectedWebhookForLogs === id) setSelectedWebhookForLogs(null);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete webhook');
    }
  };

  const handleTestPing = async (id: string) => {
    try {
      setTestingWebhookId(id);
      setTestResult(null);
      const res = await testWebhook(id);
      setTestResult({
        id,
        success: res.success,
        msg: res.success
          ? `Ping successful! (Status: ${res.status_code}, ${res.duration_ms}ms)`
          : `Ping failed: ${res.response_body || 'Status ' + res.status_code}`,
      });
      loadWebhooks();
    } catch (err: unknown) {
      setTestResult({
        id,
        success: false,
        msg: err instanceof Error ? err.message : 'Ping request failed',
      });
    } finally {
      setTestingWebhookId(null);
    }
  };

  const handleViewDeliveries = async (id: string) => {
    if (selectedWebhookForLogs === id) {
      setSelectedWebhookForLogs(null);
      return;
    }
    try {
      setSelectedWebhookForLogs(id);
      setLoadingDeliveries(true);
      const data = await fetchWebhookDeliveries(id);
      setDeliveries(data);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to load delivery logs');
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="integrations-modal-overlay" onClick={onClose}>
      <div className="integrations-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="integrations-modal-header">
          <div className="integrations-title-area">
            <div className="integrations-icon-badge">
              <KeyRound size={22} />
            </div>
            <div>
              <h2>Integrations & Developer Platform</h2>
              <p>Connect external ATS, CI pipelines, Slack bots, and ETL workflows</p>
            </div>
          </div>
          <button className="integrations-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="integrations-tabs-nav">
          <button
            className={`integrations-tab-btn ${activeTab === 'api-keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('api-keys')}
          >
            <KeyRound size={16} /> API Keys (M2M)
          </button>
          <button
            className={`integrations-tab-btn ${activeTab === 'webhooks' ? 'active' : ''}`}
            onClick={() => setActiveTab('webhooks')}
          >
            <WebhookIcon size={16} /> Outgoing Webhooks
          </button>
          <button
            className={`integrations-tab-btn ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <Download size={16} /> Data Export & Sync
          </button>
        </div>

        {/* Body */}
        <div className="integrations-modal-body">
          {actionError && (
            <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#dc2626', fontSize: '0.8125rem' }}>
              {actionError}
            </div>
          )}

          {/* TAB 1: API KEYS */}
          {activeTab === 'api-keys' && (
            <>
              {newlyCreatedKey && (
                <div className="new-key-banner">
                  <div className="new-key-header">
                    <Check size={18} /> API Key Created Successfully!
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#166534' }}>
                    Make sure to copy your API key now. You will not be able to see it again!
                  </p>
                  <div className="new-key-value-box">
                    <code>{newlyCreatedKey.raw_key}</code>
                    <button className="btn-copy" onClick={handleCopyKey}>
                      {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                      {copiedKey ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <small>
                    Stored securely as SHA-256 hash. Prefix: {newlyCreatedKey.prefix}
                  </small>
                </div>
              )}

              <div className="section-top-bar">
                <h3>Active API Keys</h3>
                <button
                  className="btn-primary-sm"
                  onClick={() => setShowCreateKeyForm(!showCreateKeyForm)}
                >
                  <Plus size={15} /> Create API Key
                </button>
              </div>

              {showCreateKeyForm && (
                <form className="inline-create-box" onSubmit={handleCreateKey}>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', color: '#0f172a' }}>New API Key Details</h4>
                  <div className="inline-form-group">
                    <label>Key Name / Description</label>
                    <input
                      type="text"
                      className="inline-form-input"
                      placeholder="e.g. ATS Sync Connector, Greenhouse Webhook, CI Pipeline"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="inline-form-group">
                    <label>Permissions / Scopes</label>
                    <div className="scopes-checkbox-grid">
                      {[
                        { id: 'candidates:read', label: 'Read Candidates' },
                        { id: 'candidates:write', label: 'Create Candidates' },
                        { id: 'scores:read', label: 'Read Scores' },
                        { id: 'scores:write', label: 'Submit Scores' },
                        { id: 'summary:read', label: 'Read AI Summaries' },
                        { id: 'admin:all', label: 'Admin (All Access)' },
                      ].map((sc) => (
                        <label key={sc.id} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedScopes.includes(sc.id)}
                            onChange={() => toggleScope(sc.id)}
                          />
                          {sc.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="inline-form-group">
                    <label>Expiration</label>
                    <select
                      className="inline-form-input"
                      value={expiresDays ?? ''}
                      onChange={(e) => setExpiresDays(e.target.value ? Number(e.target.value) : undefined)}
                    >
                      <option value="">Never Expires</option>
                      <option value="7">7 Days</option>
                      <option value="30">30 Days</option>
                      <option value="90">90 Days</option>
                      <option value="365">1 Year</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn-secondary-sm"
                      onClick={() => setShowCreateKeyForm(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary-sm" disabled={isSubmittingKey}>
                      {isSubmittingKey ? 'Generating...' : 'Generate Key'}
                    </button>
                  </div>
                </form>
              )}

              {loadingKeys ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>Loading keys...</div>
              ) : apiKeys.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                  No API keys generated yet. Create an API key to enable machine-to-machine integration.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="integration-list-table">
                    <thead>
                      <tr>
                        <th>Key Name</th>
                        <th>Prefix</th>
                        <th>Scopes</th>
                        <th>Created</th>
                        <th>Last Used</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiKeys.map((k) => (
                        <tr key={k.id}>
                          <td style={{ fontWeight: 600 }}>{k.name}</td>
                          <td><code>{k.prefix}</code></td>
                          <td>
                            {k.scopes.map((s) => (
                              <span key={s} className="scope-pill">{s}</span>
                            ))}
                          </td>
                          <td>{new Date(k.created_at).toLocaleDateString()}</td>
                          <td>{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</td>
                          <td>
                            <span className="status-badge-active">
                              <Activity size={10} /> Active
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn-revoke"
                              onClick={() => handleRevokeKey(k.id)}
                              title="Revoke Key"
                            >
                              <Trash2 size={13} /> Revoke
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Developer Quickstart cURL Snippet */}
              <div className="code-example-card">
                <div className="code-example-header">
                  <span><Code2 size={13} style={{ display: 'inline', marginRight: 4 }} /> Developer Quickstart (cURL)</span>
                </div>
                <pre>{`# 1. Fetch candidates using your API key:
curl -H "X-API-Key: tk_live_YOUR_KEY_HERE" http://localhost:8000/api/v1/candidates

# 2. Ingest a new applicant from ATS:
curl -X POST http://localhost:8000/api/v1/candidates \\
  -H "X-API-Key: tk_live_YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Alex Smith", "email": "alex@example.com", "role_applied": "Senior Backend"}'`}</pre>
              </div>
            </>
          )}

          {/* TAB 2: WEBHOOKS */}
          {activeTab === 'webhooks' && (
            <>
              <div className="section-top-bar">
                <h3>Outgoing Webhook Subscriptions</h3>
                <button
                  className="btn-primary-sm"
                  onClick={() => setShowCreateWebhookForm(!showCreateWebhookForm)}
                >
                  <Plus size={15} /> Add Webhook
                </button>
              </div>

              {showCreateWebhookForm && (
                <form className="inline-create-box" onSubmit={handleCreateWebhook}>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', color: '#0f172a' }}>Register New Webhook Endpoint</h4>
                  
                  <div className="inline-form-group">
                    <label>Endpoint URL</label>
                    <input
                      type="url"
                      className="inline-form-input"
                      placeholder="https://your-api.com/webhooks/tk-evaluations"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      required
                    />
                  </div>

                  <div className="inline-form-group">
                    <label>Secret Signing Key (optional - generated automatically if blank)</label>
                    <input
                      type="text"
                      className="inline-form-input"
                      placeholder="Leave blank for auto-generated 256-bit secret"
                      value={webhookSecret}
                      onChange={(e) => setWebhookSecret(e.target.value)}
                    />
                  </div>

                  <div className="inline-form-group">
                    <label>Description / Target System</label>
                    <input
                      type="text"
                      className="inline-form-input"
                      placeholder="e.g. Slack #interviews channel, ATS scorecard sync"
                      value={webhookDesc}
                      onChange={(e) => setWebhookDesc(e.target.value)}
                    />
                  </div>

                  <div className="inline-form-group">
                    <label>Subscribed Events</label>
                    <div className="scopes-checkbox-grid">
                      {[
                        { id: 'candidate.created', label: 'candidate.created' },
                        { id: 'candidate.status_changed', label: 'candidate.status_changed' },
                        { id: 'score.submitted', label: 'score.submitted' },
                        { id: 'summary.generated', label: 'summary.generated' },
                      ].map((ev) => (
                        <label key={ev.id} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedEvents.includes(ev.id)}
                            onChange={() => toggleEvent(ev.id)}
                          />
                          {ev.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn-secondary-sm"
                      onClick={() => setShowCreateWebhookForm(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary-sm" disabled={isSubmittingWebhook}>
                      {isSubmittingWebhook ? 'Registering...' : 'Register Webhook'}
                    </button>
                  </div>
                </form>
              )}

              {loadingWebhooks ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>Loading webhooks...</div>
              ) : webhooks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                  No webhooks configured. Add a webhook URL to receive instant HTTP notifications for candidate and score events.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {webhooks.map((wh) => (
                    <div key={wh.id} className="webhook-card">
                      <div className="webhook-card-top">
                        <div>
                          <div className="webhook-url-line">{wh.url}</div>
                          {wh.description && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{wh.description}</div>
                          )}
                          <div style={{ marginTop: '0.375rem' }}>
                            {wh.events.map((ev) => (
                              <span key={ev} className="scope-pill">{ev}</span>
                            ))}
                          </div>
                        </div>
                        <div className="webhook-card-actions">
                          <button
                            className="btn-secondary-sm"
                            onClick={() => handleTestPing(wh.id)}
                            disabled={testingWebhookId === wh.id}
                            title="Send Test Event"
                          >
                            {testingWebhookId === wh.id ? (
                              <RefreshCw size={13} className="spin-icon" />
                            ) : (
                              <Send size={13} />
                            )}
                            Test Ping
                          </button>
                          <button
                            className="btn-secondary-sm"
                            onClick={() => handleViewDeliveries(wh.id)}
                          >
                            <FileText size={13} />
                            {selectedWebhookForLogs === wh.id ? 'Hide Logs' : 'Logs'}
                          </button>
                          <button
                            className="btn-revoke"
                            onClick={() => handleDeleteWebhook(wh.id)}
                            title="Delete Webhook"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {testResult && testResult.id === wh.id && (
                        <div style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.375rem',
                          background: testResult.success ? '#f0fdf4' : '#fef2f2',
                          color: testResult.success ? '#15803d' : '#dc2626',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                        }}>
                          {testResult.msg}
                        </div>
                      )}

                      {/* Delivery logs drawer */}
                      {selectedWebhookForLogs === wh.id && (
                        <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', marginTop: '0.25rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
                            Recent Delivery History (Last 20)
                          </div>
                          {loadingDeliveries ? (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Loading logs...</div>
                          ) : deliveries.length === 0 ? (
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No delivery events recorded yet.</div>
                          ) : (
                            deliveries.map((del) => (
                              <div key={del.id} className={`delivery-log-item ${del.success ? 'success' : 'fail'}`}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <strong>{del.event_name}</strong>
                                  <span>{del.response_status_code ? `HTTP ${del.response_status_code}` : 'Failed'} ({del.duration_ms}ms)</span>
                                </div>
                                <span style={{ color: '#64748b' }}>{new Date(del.created_at).toLocaleString()}</span>
                                {del.response_body && (
                                  <code style={{ fontSize: '0.6875rem', color: '#475569', background: '#e2e8f0', padding: '2px 4px', borderRadius: 3 }}>
                                    {del.response_body.slice(0, 120)}
                                  </code>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Webhook Signature Verification Snippet */}
              <div className="code-example-card">
                <div className="code-example-header">
                  <span><Code2 size={13} style={{ display: 'inline', marginRight: 4 }} /> HMAC-SHA256 Payload Signature Verification</span>
                </div>
                <pre>{`# Python Webhook Receiver Verification Example:
import hmac, hashlib

def verify_signature(payload_bytes, signature_header, secret):
    expected = "sha256=" + hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)`}</pre>
              </div>
            </>
          )}

          {/* TAB 3: DATA EXPORT & ETL SYNC */}
          {activeTab === 'export' && (
            <>
              <div className="section-top-bar">
                <h3>Data Export & ETL Pipeline Bridges</h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>Filter by Status:</label>
                <select
                  className="inline-form-input"
                  style={{ width: 'auto', padding: '0.35rem 0.65rem' }}
                  value={exportStatusFilter}
                  onChange={(e) => setExportStatusFilter(e.target.value)}
                >
                  <option value="">All Candidates (Active)</option>
                  <option value="new">New</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="hired">Hired</option>
                  <option value="rejected">Rejected</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="export-grid">
                <div className="export-card">
                  <h4>CSV Spreadsheet Export</h4>
                  <p>
                    Download a flat tabular dataset with candidate profiles, calculated average scores, total review counts, and AI summaries. Perfect for Excel, Google Sheets, and HR reporting.
                  </p>
                  <a
                    href={getExportCsvUrl(exportStatusFilter || undefined)}
                    download
                    className="btn-primary-sm"
                    style={{ textDecoration: 'none', justifyContent: 'center' }}
                  >
                    <Download size={15} /> Download Candidates (.csv)
                  </a>
                </div>

                <div className="export-card">
                  <h4>JSON Structured ETL Export</h4>
                  <p>
                    Full nested JSON data model including candidate records, reviewer ratings, notes, timestamps, and AI evaluations. Ideal for BigQuery/Snowflake ingestion or microservice data sync.
                  </p>
                  <a
                    href={getExportJsonUrl(exportStatusFilter || undefined)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary-sm"
                    style={{ textDecoration: 'none', justifyContent: 'center' }}
                  >
                    <Download size={15} /> Fetch JSON Payload (.json)
                  </a>
                </div>
              </div>

              <div className="code-example-card" style={{ marginTop: '0.5rem' }}>
                <div className="code-example-header">
                  <span><Code2 size={13} style={{ display: 'inline', marginRight: 4 }} /> Scheduled ETL / Automated Pull</span>
                </div>
                <pre>{`# Run nightly sync to your data warehouse via curl / cron:
curl -H "X-API-Key: tk_live_YOUR_KEY" \\
     "http://localhost:8000/api/v1/export/candidates.json" \\
     -o /opt/data/candidates_\$(date +%Y%m%d).json`}</pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
