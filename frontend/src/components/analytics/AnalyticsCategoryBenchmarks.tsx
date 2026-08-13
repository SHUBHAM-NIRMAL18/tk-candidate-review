import React from 'react';
import { Award } from 'lucide-react';
import type { CategoryMetric } from '../../types/analytics';

interface AnalyticsCategoryBenchmarksProps {
  categories: CategoryMetric[];
}

export const AnalyticsCategoryBenchmarks: React.FC<AnalyticsCategoryBenchmarksProps> = ({ categories }) => {
  return (
    <section className="analytics-section-card">
      <div className="section-title-row">
        <div className="section-title">
          <div className="section-icon-wrap cyan">
            <Award size={18} />
          </div>
          <div>
            <h2 className="section-heading">Category Benchmarks</h2>
            <p className="section-subtitle">Average score by evaluation rubric</p>
          </div>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="empty-analytics-msg">No evaluation scores submitted yet.</div>
      ) : (
        <div className="category-list">
          {categories.map((cat) => {
            const scorePct = (cat.average_score / 5) * 100;
            return (
              <div key={cat.category} className="category-item-row">
                <div className="category-name-score">
                  <span className="category-name">{cat.category}</span>
                  <span className="category-badge-score">
                    <strong>{cat.average_score}</strong> / 5.0 ({cat.review_count} {cat.review_count === 1 ? 'review' : 'reviews'})
                  </span>
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
  );
};
