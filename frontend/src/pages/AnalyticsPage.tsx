import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import {
  BarChart3,
  Users,
  Star,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  Award,
  Layers,
  Sparkles,
  Shield,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { fetchAnalytics } from '../api/analytics';
import type { AnalyticsResponse } from '../types/analytics';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';
import { type ToastData } from '../utils/toast';
import '../styles/AnalyticsPage.css';

export const AnalyticsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const loadData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await fetchAnalytics();
      setAnalytics(res);
      if (isManualRefresh) {
        setToast({ title: 'Refreshed', message: 'Analytics metrics updated successfully', type: 'success' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load analytics';
      setToast({ title: 'Error', message: msg, type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      navigate('/login');
    } catch {
      setToast({ title: 'Logout Failed', message: 'Could not complete logout session', type: 'error' });
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  return (
    <div className="analytics-container">
      {/* Top Header & Navigation */}
      <header className="analytics-header">
        <div className="analytics-top-bar">
          <div className="brand-section">
            <img src="/TechKraft-Logo.svg" alt="TechKraft Logo" className="dashboard-logo" style={{ height: '18px', width: 'auto', display: 'block' }} />
            <span className="brand-title" style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>Candidate Review Dashboard</span>
          </div>

          <div className="nav-tabs">
            <button
              className="nav-tab-btn"
              onClick={() => navigate('/')}
            >
              <Users size={16} />
              <span>Candidates</span>
            </button>
            <button
              className="nav-tab-btn active"
              onClick={() => {}}
            >
              <BarChart3 size={16} />
              <span>Analytics</span>
            </button>
          </div>

          <div className="user-profile-controls">
            <div className={`user-role-badge ${user?.role || 'reviewer'}`}>
              <Shield size={12} style={{ display: 'inline', marginRight: 4 }} />
              {user?.role}
            </div>
            <span className="user-email-text">{user?.email}</span>
            <button
              className="refresh-btn"
              onClick={() => loadData(true)}
              disabled={refreshing || loading}
              title="Refresh metrics"
            >
              <RefreshCw size={14} className={refreshing ? 'loading-spinner' : ''} />
              <span>Refresh</span>
            </button>
            <button
              className="refresh-btn"
              onClick={() => setShowLogoutModal(true)}
              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </div>

        <div className="analytics-title-banner">
          <div>
            <h1 className="banner-heading">Hiring Pipeline & Evaluation Analytics</h1>
            <p className="banner-subheading">
              Real-time insights across candidate velocity, score distribution, and evaluation benchmarks.
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {loading ? (
        <div className="analytics-loading-box">
          <div className="loading-spinner"></div>
          <div>Loading analytics intelligence...</div>
        </div>
      ) : !analytics ? (
        <div className="analytics-loading-box">
          <div>No analytics data available.</div>
        </div>
      ) : (
        <>
          {/* 1. KPI Summary Cards */}
          <section className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-label">Active Pipeline</span>
                <div className="kpi-icon-pill blue">
                  <Users size={18} />
                </div>
              </div>
              <div className="kpi-value-row">
                <span className="kpi-value">{analytics.kpis.active_candidates}</span>
                <span className="kpi-subtext">/ {analytics.kpis.total_candidates} total</span>
              </div>
              <div className="kpi-subtext">
                {analytics.kpis.archived_candidates} archived candidates
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-label">Global Average Rating</span>
                <div className="kpi-icon-pill amber">
                  <Star size={18} />
                </div>
              </div>
              <div className="kpi-value-row">
                <span className="kpi-value">
                  {analytics.kpis.average_score !== null ? `${analytics.kpis.average_score}` : 'N/A'}
                </span>
                <span className="kpi-subtext">/ 5.0</span>
              </div>
              <div className="kpi-subtext">Across all reviewer evaluations</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-label">Reviews Submitted</span>
                <div className="kpi-icon-pill emerald">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div className="kpi-value-row">
                <span className="kpi-value">{analytics.kpis.total_reviews}</span>
                <span className="kpi-subtext">scores logged</span>
              </div>
              <div className="kpi-subtext">Total feedback entries</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-label">Review Coverage</span>
                <div className="kpi-icon-pill purple">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="kpi-value-row">
                <span className="kpi-value">{analytics.kpis.review_coverage_pct}%</span>
              </div>
              <div className="kpi-subtext">Active candidates evaluated</div>
            </div>
          </section>

          {/* 2. Hiring Funnel Flow */}
          <section className="analytics-section-card">
            <div className="section-title-row">
              <div className="section-title">
                <Layers size={18} color="#3b82f6" />
                <span>Hiring Pipeline Funnel</span>
              </div>
              <span className="section-subtitle">Candidate status distribution across all stages</span>
            </div>

            <div className="funnel-pipeline-container">
              {analytics.funnel.map((f) => (
                <div key={f.stage} className="funnel-stage-card">
                  <div className="funnel-stage-top">
                    <span className={`stage-pill ${f.stage}`}>{f.label}</span>
                    <span className="funnel-count">{f.count}</span>
                  </div>
                  <div className="funnel-progress-bg">
                    <div
                      className={`funnel-progress-fill ${f.stage}`}
                      style={{ width: `${Math.max(f.percentage, f.count > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                  <div className="funnel-pct-text">
                    <span>{f.percentage}% of pipeline</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Evaluation Benchmarks & Score Distribution */}
          <div className="analytics-two-col">
            <section className="analytics-section-card">
              <div className="section-title-row">
                <div className="section-title">
                  <Award size={18} color="#06b6d4" />
                  <span>Category Benchmarks</span>
                </div>
                <span className="section-subtitle">Average score by evaluation rubric</span>
              </div>

              {analytics.categories.length === 0 ? (
                <div className="kpi-subtext" style={{ padding: '1rem 0' }}>No evaluation scores submitted yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {analytics.categories.map((cat) => {
                    const scorePct = (cat.average_score / 5) * 100;
                    return (
                      <div key={cat.category} className="category-item-row">
                        <div className="category-name-score">
                          <span className="category-name">{cat.category}</span>
                          <span className="category-badge-score">{cat.average_score} / 5.0 ({cat.review_count} reviews)</span>
                        </div>
                        <div className="cat-bar-bg">
                          <div className="cat-bar-fill" style={{ width: `${scorePct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="analytics-section-card">
              <div className="section-title-row">
                <div className="section-title">
                  <Star size={18} color="#f59e0b" />
                  <span>Score Rating Distribution</span>
                </div>
                <span className="section-subtitle">Frequency of scores from 1 to 5</span>
              </div>

              <div className="score-dist-grid">
                {[5, 4, 3, 2, 1].map((starVal) => {
                  const item = analytics.score_distribution.find((s) => s.score === starVal) || {
                    score: starVal,
                    count: 0,
                    percentage: 0,
                  };
                  return (
                    <div key={starVal} className="score-row">
                      <div className="star-label">
                        <span>{starVal}</span>
                        <Star size={14} fill="#facc15" color="#facc15" />
                      </div>
                      <div className="score-bar-bg">
                        <div
                          className="score-bar-fill"
                          style={{ width: `${Math.max(item.percentage, item.count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <div className="score-count-label">
                        {item.count} ({item.percentage}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* 4. Roles & Skills Breakdown */}
          <div className="analytics-two-col">
            <section className="analytics-section-card">
              <div className="section-title-row">
                <div className="section-title">
                  <Users size={18} color="#8b5cf6" />
                  <span>Roles in Demand</span>
                </div>
                <span className="section-subtitle">Candidate share and average ratings per role</span>
              </div>

              {analytics.roles.length === 0 ? (
                <div className="kpi-subtext" style={{ padding: '1rem 0' }}>No active candidates recorded.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {analytics.roles.map((r) => (
                    <div key={r.role} className="category-item-row">
                      <div className="category-name-score">
                        <span className="category-name">{r.role}</span>
                        <span style={{ color: '#a5b4fc', fontSize: '0.8125rem' }}>
                          {r.candidate_count} applicants ({r.percentage}%) &bull;{' '}
                          {r.average_score !== null ? `Avg ${r.average_score}/5` : 'Unrated'}
                        </span>
                      </div>
                      <div className="cat-bar-bg">
                        <div
                          className="cat-bar-fill"
                          style={{
                            width: `${r.percentage}%`,
                            background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="analytics-section-card">
              <div className="section-title-row">
                <div className="section-title">
                  <Sparkles size={18} color="#10b981" />
                  <span>Top In-Demand Skills</span>
                </div>
                <span className="section-subtitle">Frequency of technical tags across candidate pool</span>
              </div>

              {analytics.top_skills.length === 0 ? (
                <div className="kpi-subtext" style={{ padding: '1rem 0' }}>No skill tags extracted.</div>
              ) : (
                <div className="skills-cloud-wrap">
                  {analytics.top_skills.map((sk) => (
                    <div key={sk.skill} className="skill-tag-pill">
                      <span>{sk.skill}</span>
                      <span className="skill-count-badge">{sk.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* 5. Leaderboard & Reviewer Contribution */}
          <div className="analytics-two-col">
            <section className="analytics-section-card">
              <div className="section-title-row">
                <div className="section-title">
                  <Award size={18} color="#f59e0b" />
                  <span>Top-Rated Candidates</span>
                </div>
                <span className="section-subtitle">Highest average evaluation ratings</span>
              </div>

              {analytics.top_candidates.length === 0 ? (
                <div className="kpi-subtext" style={{ padding: '1rem 0' }}>No rated candidates yet.</div>
              ) : (
                <div className="leaderboard-list">
                  {analytics.top_candidates.map((cand, idx) => {
                    const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-other';
                    return (
                      <div
                        key={cand.id}
                        className="leaderboard-item"
                        onClick={() => navigate(`/candidate/${cand.id}`)}
                      >
                        <div className="leaderboard-left">
                          <div className={`rank-badge ${rankClass}`}>#{idx + 1}</div>
                          <div>
                            <div className="cand-name-title">{cand.name}</div>
                            <div className="cand-role-sub">{cand.role_applied} &bull; {cand.reviews_count} review(s)</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="cand-score-pill">
                            <Star size={14} fill="#60a5fa" color="#60a5fa" />
                            <span>{cand.average_score}</span>
                          </div>
                          <ChevronRight size={16} color="#64748b" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="analytics-section-card">
              <div className="section-title-row">
                <div className="section-title">
                  <Shield size={18} color="#3b82f6" />
                  <span>{isAdmin ? 'Team Reviewer Activity' : 'My Reviewer Impact'}</span>
                </div>
                <span className="section-subtitle">
                  {isAdmin ? 'Evaluation contributions by reviewer' : 'Your personal contribution summary'}
                </span>
              </div>

              {isAdmin && analytics.reviewer_activity ? (
                <div className="reviewer-table-wrap">
                  <table className="reviewer-matrix-table">
                    <thead>
                      <tr>
                        <th>Reviewer</th>
                        <th>Reviews Logged</th>
                        <th>Avg Score Given</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.reviewer_activity.map((ra) => (
                        <tr key={ra.reviewer_id}>
                          <td>{ra.reviewer_email}</td>
                          <td>
                            <strong>{ra.reviews_count}</strong>
                          </td>
                          <td>
                            {ra.average_score_given !== null ? (
                              <span style={{ color: '#60a5fa', fontWeight: 600 }}>
                                {ra.average_score_given} / 5.0
                              </span>
                            ) : (
                              'N/A'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="personal-impact-box">
                  <div className="impact-row">
                    <div className="impact-metric">
                      <span className="impact-label">Reviews You Logged</span>
                      <span className="impact-value">{analytics.my_stats?.my_reviews_count ?? 0}</span>
                    </div>
                    <div className="impact-metric">
                      <span className="impact-label">Candidates Evaluated</span>
                      <span className="impact-value">{analytics.my_stats?.my_candidates_reviewed ?? 0}</span>
                    </div>
                    <div className="impact-metric">
                      <span className="impact-label">Your Avg Rating Given</span>
                      <span className="impact-value">
                        {analytics.my_stats?.my_average_score !== null && analytics.my_stats?.my_average_score !== undefined
                          ? `${analytics.my_stats.my_average_score} / 5.0`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <ConfirmModal
          title="Confirm Logout"
          message="Are you sure you want to log out? Your session token will be revoked."
          confirmLabel="Yes, Logout"
          cancelLabel="Stay Logged In"
          loading={isLoggingOut}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}

      {/* Toast notifications */}
      {toast && (
        <Toast
          title={toast.title}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
