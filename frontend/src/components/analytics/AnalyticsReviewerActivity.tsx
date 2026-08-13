import React from 'react';
import { Shield, UserCheck } from 'lucide-react';
import type { ReviewerActivityMetric, PersonalReviewerStats } from '../../types/analytics';

interface AnalyticsReviewerActivityProps {
  isAdmin: boolean;
  reviewerActivity?: ReviewerActivityMetric[] | null;
  myStats?: PersonalReviewerStats | null;
}

export const AnalyticsReviewerActivity: React.FC<AnalyticsReviewerActivityProps> = ({
  isAdmin,
  reviewerActivity,
  myStats,
}) => {
  return (
    <section className="analytics-section-card">
      <div className="section-title-row">
        <div className="section-title">
          <div className="section-icon-wrap blue">
            {isAdmin ? <Shield size={18} /> : <UserCheck size={18} />}
          </div>
          <div>
            <h2 className="section-heading">
              {isAdmin ? 'Team Reviewer Activity' : 'My Reviewer Impact'}
            </h2>
            <p className="section-subtitle">
              {isAdmin
                ? 'Evaluation contributions across the hiring team'
                : 'Your personal candidate evaluation contribution'}
            </p>
          </div>
        </div>
      </div>

      {isAdmin && reviewerActivity ? (
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
              {reviewerActivity.length === 0 ? (
                <tr>
                  <td colSpan={3} className="empty-table-cell">
                    No reviewer activity recorded yet.
                  </td>
                </tr>
              ) : (
                reviewerActivity.map((ra) => (
                  <tr key={ra.reviewer_id}>
                    <td className="reviewer-email-cell">{ra.reviewer_email}</td>
                    <td>
                      <span className="count-pill">{ra.reviews_count}</span>
                    </td>
                    <td>
                      {ra.average_score_given !== null ? (
                        <span className="avg-score-badge">
                          {ra.average_score_given} / 5.0
                        </span>
                      ) : (
                        <span className="unrated-text">N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="personal-impact-box">
          <div className="impact-grid">
            <div className="impact-card">
              <span className="impact-label">Reviews You Logged</span>
              <span className="impact-value">{myStats?.my_reviews_count ?? 0}</span>
              <span className="impact-sub">total evaluations</span>
            </div>
            <div className="impact-card">
              <span className="impact-label">Candidates Evaluated</span>
              <span className="impact-value">{myStats?.my_candidates_reviewed ?? 0}</span>
              <span className="impact-sub">unique applicants</span>
            </div>
            <div className="impact-card">
              <span className="impact-label">Your Avg Rating Given</span>
              <span className="impact-value">
                {myStats?.my_average_score !== null && myStats?.my_average_score !== undefined
                  ? `${myStats.my_average_score}`
                  : 'N/A'}
              </span>
              <span className="impact-sub">out of 5.0</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
