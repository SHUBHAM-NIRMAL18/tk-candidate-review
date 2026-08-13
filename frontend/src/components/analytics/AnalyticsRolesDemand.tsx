import React from 'react';
import { Users } from 'lucide-react';
import type { RoleMetric } from '../../types/analytics';

interface AnalyticsRolesDemandProps {
  roles: RoleMetric[];
}

export const AnalyticsRolesDemand: React.FC<AnalyticsRolesDemandProps> = ({ roles }) => {
  return (
    <section className="analytics-section-card">
      <div className="section-title-row">
        <div className="section-title">
          <div className="section-icon-wrap purple">
            <Users size={18} />
          </div>
          <div>
            <h2 className="section-heading">Roles in Demand</h2>
            <p className="section-subtitle">Candidate share and average ratings per role</p>
          </div>
        </div>
      </div>

      {roles.length === 0 ? (
        <div className="empty-analytics-msg">No active candidates recorded.</div>
      ) : (
        <div className="roles-list">
          {roles.map((r) => (
            <div key={r.role} className="category-item-row">
              <div className="category-name-score">
                <span className="category-name">{r.role}</span>
                <span className="role-meta-badge">
                  <strong>{r.candidate_count}</strong> {r.candidate_count === 1 ? 'applicant' : 'applicants'} ({r.percentage}%) &bull;{' '}
                  {r.average_score !== null ? `Avg ${r.average_score}/5` : 'Unrated'}
                </span>
              </div>
              <div className="cat-bar-bg">
                <div
                  className="cat-bar-fill purple-gradient"
                  style={{ width: `${r.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
