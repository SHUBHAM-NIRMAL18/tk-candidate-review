import React from 'react';
import { Layers } from 'lucide-react';
import type { FunnelStageMetric } from '../../types/analytics';

interface AnalyticsFunnelProps {
  funnel: FunnelStageMetric[];
}

export const AnalyticsFunnel: React.FC<AnalyticsFunnelProps> = ({ funnel }) => {
  return (
    <section className="analytics-section-card">
      <div className="section-title-row">
        <div className="section-title">
          <div className="section-icon-wrap blue">
            <Layers size={18} />
          </div>
          <div>
            <h2 className="section-heading">Hiring Pipeline Funnel</h2>
            <p className="section-subtitle">Candidate status distribution across active recruitment stages</p>
          </div>
        </div>
      </div>

      <div className="funnel-pipeline-container">
        {funnel.map((f) => (
          <div key={f.stage} className="funnel-stage-card">
            <div className="funnel-stage-top">
              <span className={`stage-pill ${f.stage}`}>{f.label}</span>
              <span className="funnel-count">{f.count}</span>
            </div>
            <div className="funnel-progress-bg">
              <div
                className={`funnel-progress-fill ${f.stage}`}
                style={{ width: `${Math.max(f.percentage, f.count > 0 ? 6 : 0)}%` }}
              />
            </div>
            <div className="funnel-pct-text">
              <span>{f.percentage}% of pipeline</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
