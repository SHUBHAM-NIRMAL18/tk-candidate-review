import React from 'react';
import { Sparkles, AlertCircle, RotateCcw } from 'lucide-react';

interface AISummaryCardProps {
  summary?: string | null;
  aiState: 'idle' | 'loading' | 'error';
  aiErrorMsg: string | null;
  onGenerate: () => void;
}

export const AISummaryCard: React.FC<AISummaryCardProps> = ({
  summary,
  aiState,
  aiErrorMsg,
  onGenerate,
}) => {
  return (
    <div className="detail-card ai-card">
      <div className="card-header ai-header">
        <div className="ai-title-wrap">
          <Sparkles size={18} className="sparkle-icon" />
          <h3>AI Candidate Summary</h3>
        </div>
        <button
          onClick={onGenerate}
          disabled={aiState === 'loading'}
          className="btn-ai-action"
        >
          <Sparkles size={14} />
          <span>{summary ? 'Re-generate' : 'Generate'}</span>
        </button>
      </div>

      <div className="ai-card-content">
        {aiState === 'loading' ? (
          <div className="ai-loading-box">
            <div className="spinner-sm" />
            <p>⏳ Analyzing evaluation scores & generating summary...</p>
          </div>
        ) : aiState === 'error' ? (
          <div className="ai-error-box">
            <AlertCircle size={18} />
            <span>Failed: {aiErrorMsg}</span>
            <button onClick={onGenerate} className="btn-retry-sm">
              <RotateCcw size={12} />
              <span>Retry</span>
            </button>
          </div>
        ) : summary ? (
          <p className="ai-summary-text">{summary}</p>
        ) : (
          <p className="ai-placeholder">
            Click <strong>Generate</strong> to summarize ratings and qualifications.
          </p>
        )}
      </div>
    </div>
  );
};
