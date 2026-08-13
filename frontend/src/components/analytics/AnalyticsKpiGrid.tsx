import React from 'react';
import { Users, Star, CheckCircle2, TrendingUp } from 'lucide-react';
import type { KPISummary } from '../../types/analytics';

interface AnalyticsKpiGridProps {
  kpis: KPISummary;
}

export const AnalyticsKpiGrid: React.FC<AnalyticsKpiGridProps> = ({ kpis }) => {
  return (
    <section className="kpi-grid">
      {/* 1. Active Pipeline */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Active Pipeline</span>
          <div className="kpi-icon-pill blue">
            <Users size={18} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">{kpis.active_candidates}</span>
          <span className="kpi-subtext">/ {kpis.total_candidates} total</span>
        </div>
        <div className="kpi-footer-text">
          {kpis.archived_candidates} archived candidates
        </div>
      </div>

      {/* 2. Global Average Rating */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Global Average Rating</span>
          <div className="kpi-icon-pill amber">
            <Star size={18} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">
            {kpis.average_score !== null ? `${kpis.average_score}` : 'N/A'}
          </span>
          <span className="kpi-subtext">/ 5.0</span>
        </div>
        <div className="kpi-footer-text">Across all reviewer evaluations</div>
      </div>

      {/* 3. Reviews Submitted */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Reviews Submitted</span>
          <div className="kpi-icon-pill emerald">
            <CheckCircle2 size={18} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">{kpis.total_reviews}</span>
          <span className="kpi-subtext">scores logged</span>
        </div>
        <div className="kpi-footer-text">Total feedback entries</div>
      </div>

      {/* 4. Review Coverage */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Review Coverage</span>
          <div className="kpi-icon-pill purple">
            <TrendingUp size={18} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">{kpis.review_coverage_pct}%</span>
        </div>
        <div className="kpi-footer-text">Active candidates evaluated</div>
      </div>
    </section>
  );
};
