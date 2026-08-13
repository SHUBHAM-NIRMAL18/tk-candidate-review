import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Star, ChevronRight } from 'lucide-react';
import type { TopCandidateMetric } from '../../types/analytics';

interface AnalyticsLeaderboardProps {
  topCandidates: TopCandidateMetric[];
}

export const AnalyticsLeaderboard: React.FC<AnalyticsLeaderboardProps> = ({ topCandidates }) => {
  const navigate = useNavigate();

  return (
    <section className="analytics-section-card">
      <div className="section-title-row">
        <div className="section-title">
          <div className="section-icon-wrap amber">
            <Award size={18} />
          </div>
          <div>
            <h2 className="section-heading">Top-Rated Candidates</h2>
            <p className="section-subtitle">Highest average evaluation ratings</p>
          </div>
        </div>
      </div>

      {topCandidates.length === 0 ? (
        <div className="empty-analytics-msg">No rated candidates yet.</div>
      ) : (
        <div className="leaderboard-list">
          {topCandidates.map((cand, idx) => {
            const rankClass =
              idx === 0
                ? 'rank-1'
                : idx === 1
                ? 'rank-2'
                : idx === 2
                ? 'rank-3'
                : 'rank-other';

            return (
              <div
                key={cand.id}
                className="leaderboard-item"
                onClick={() => navigate(`/candidate/${cand.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate(`/candidate/${cand.id}`);
                  }
                }}
              >
                <div className="leaderboard-left">
                  <div className={`rank-badge ${rankClass}`}>#{idx + 1}</div>
                  <div>
                    <div className="cand-name-title">{cand.name}</div>
                    <div className="cand-role-sub">
                      {cand.role_applied} &bull; {cand.reviews_count} {cand.reviews_count === 1 ? 'review' : 'reviews'}
                    </div>
                  </div>
                </div>
                <div className="leaderboard-right">
                  <div className="cand-score-pill">
                    <Star size={14} fill="#f59e0b" color="#f59e0b" />
                    <span>{cand.average_score}</span>
                  </div>
                  <ChevronRight size={16} className="chevron-icon" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
