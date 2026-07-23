import React, { useState } from 'react';
import { Star, Radio } from 'lucide-react';
import type { Score } from '../types/candidate';

interface CandidateScoresCardProps {
  scores: Score[];
  isAdmin: boolean;
  onScoreSubmit: (category: string, score: number, note: string) => Promise<void>;
}

export const CandidateScoresCard: React.FC<CandidateScoresCardProps> = ({
  scores,
  isAdmin,
  onScoreSubmit,
}) => {
  const [category, setCategory] = useState('Technical Depth');
  const [scoreVal, setScoreVal] = useState(4);
  const [scoreNote, setScoreNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await onScoreSubmit(category, scoreVal, scoreNote);
      setScoreNote('');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateAverageScore = (): string => {
    if (!scores || scores.length === 0) return '--';
    const sum = scores.reduce((acc, curr) => acc + curr.score, 0);
    return (sum / scores.length).toFixed(1);
  };

  return (
    <div className="detail-card scores-card">
      <div className="card-header">
        <h3>{isAdmin ? 'ALL REVIEWER SCORES' : 'MY SCORES'}</h3>
        <div className="live-badge">
          <Radio size={12} className="live-dot" />
          <span>Live Updates</span>
        </div>
      </div>

      {scores.length === 0 ? (
        <div className="empty-scores-box">
          <Star size={24} className="empty-star-icon" />
          <p className="empty-title">No evaluation scores submitted yet.</p>
          <span className="empty-sub">Submit your category rating using the form below.</span>
        </div>
      ) : (
        <div className="scores-table-wrap">
          <table className="scores-table">
            <thead>
              <tr>
                {isAdmin && <th style={{ width: '25%' }}>Reviewer</th>}
                <th style={{ width: isAdmin ? '22%' : '30%' }}>Category</th>
                <th style={{ width: isAdmin ? '15%' : '20%' }}>Score</th>
                <th style={{ width: isAdmin ? '26%' : '35%' }}>Note</th>
                <th style={{ width: isAdmin ? '12%' : '15%' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s) => (
                <tr key={s.id}>
                  {isAdmin && (
                    <td className="reviewer-email-td">
                      {s.reviewer_email || 'Reviewer'}
                    </td>
                  )}
                  <td>
                    <strong>{s.category}</strong>
                  </td>
                  <td>
                    <div className="rating-stars-badge">
                      <Star size={14} className="star-icon" />
                      <span>{s.score} / 5</span>
                    </div>
                  </td>
                  <td className="note-td">{s.note ? `"${s.note}"` : '—'}</td>
                  <td className="date-td">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {isAdmin && scores.length > 0 && (
            <div className="avg-score-summary-bar">
              <span>Overall Average Rating:</span>
              <strong className="avg-val">{calculateAverageScore()} / 5.0</strong>
            </div>
          )}
        </div>
      )}

      <div className="scoring-subcard">
        <h4>Submit Evaluation Score</h4>
        <form onSubmit={handleSubmit} className="score-form">
          <div className="form-group-inline">
            <label>Category:</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={submitting}
            >
              <option value="Technical Depth">Technical Depth</option>
              <option value="Communication">Communication</option>
              <option value="System Architecture">System Architecture</option>
              <option value="Code Quality">Code Quality</option>
              <option value="Problem Solving">Problem Solving</option>
            </select>
          </div>

          <div className="form-group-inline">
            <label>Score (1-5):</label>
            <div className="score-selector">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`score-option-btn ${scoreVal === val ? 'active' : ''}`}
                  onClick={() => setScoreVal(val)}
                  disabled={submitting}
                >
                  {val} ★
                </button>
              ))}
            </div>
          </div>

          <div className="form-group-inline">
            <label>Note:</label>
            <input
              type="text"
              placeholder="Optional evaluation note..."
              value={scoreNote}
              onChange={(e) => setScoreNote(e.target.value)}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="btn-submit-score"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Score'}
          </button>
        </form>
      </div>
    </div>
  );
};
