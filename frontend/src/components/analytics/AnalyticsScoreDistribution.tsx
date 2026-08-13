import React from 'react';
import { Star } from 'lucide-react';
import type { ScoreDistributionMetric } from '../../types/analytics';

interface AnalyticsScoreDistributionProps {
  scoreDistribution: ScoreDistributionMetric[];
}

export const AnalyticsScoreDistribution: React.FC<AnalyticsScoreDistributionProps> = ({
  scoreDistribution,
}) => {
  return (
    <section className="analytics-section-card">
      <div className="section-title-row">
        <div className="section-title">
          <div className="section-icon-wrap amber">
            <Star size={18} />
          </div>
          <div>
            <h2 className="section-heading">Score Rating Distribution</h2>
            <p className="section-subtitle">Frequency of scores from 1 to 5</p>
          </div>
        </div>
      </div>

      <div className="score-dist-grid">
        {[5, 4, 3, 2, 1].map((starVal) => {
          const item = scoreDistribution.find((s) => s.score === starVal) || {
            score: starVal,
            count: 0,
            percentage: 0,
          };
          return (
            <div key={starVal} className="score-row">
              <div className="star-label">
                <span>{starVal}</span>
                <Star size={14} fill="#f59e0b" color="#f59e0b" />
              </div>
              <div className="score-bar-bg">
                <div
                  className="score-bar-fill"
                  style={{ width: `${Math.max(item.percentage, item.count > 0 ? 5 : 0)}%` }}
                />
              </div>
              <div className="score-count-label">
                <strong>{item.count}</strong> ({item.percentage}%)
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
