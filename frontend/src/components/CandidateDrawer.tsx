import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Star,
  Archive,
  Save,
  Briefcase,
  Calendar,
  Lock,
  Check,
} from 'lucide-react';
import type { Candidate, CandidateDetail, Score } from '../types/candidate';
import {
  fetchCandidateById,
  submitScore,
  generateAISummary,
  updateCandidateNotes,
  updateCandidateStatus,
} from '../api/candidate';
import '../styles/CandidateDrawer.css';

interface CandidateDrawerProps {
  candidate: Candidate | null;
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  onCandidateUpdate?: () => void;
  candidatesList?: Candidate[];
  onSelectCandidate?: (cand: Candidate) => void;
  onOpenArchiveModal?: (cand: Candidate) => void;
}

export const CandidateDrawer: React.FC<CandidateDrawerProps> = ({
  candidate,
  isOpen,
  onClose,
  userRole,
  onCandidateUpdate,
  candidatesList = [],
  onSelectCandidate,
  onOpenArchiveModal,
}) => {
  const navigate = useNavigate();
  const isAdmin = userRole === 'admin';

  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Status state
  const [currentStatus, setCurrentStatus] = useState<string>('new');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Quick Score state
  const [scoreCategory, setScoreCategory] = useState('Technical Depth');
  const [scoreVal, setScoreVal] = useState(4);
  const [scoreNote, setScoreNote] = useState('');
  const [submittingScore, setSubmittingScore] = useState(false);

  // AI summary state
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  // Admin notes state
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSavedSuccess, setNotesSavedSuccess] = useState(false);

  // Load detail when candidate changes
  const loadDetail = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const res = await fetchCandidateById(id);
      setDetail(res);
      setCurrentStatus(res.status);
      setAiSummary(res.ai_summary || null);
      setNotes(res.internal_notes || '');
    } catch {
      // Fallback to basic candidate if detail fetch fails
      if (candidate) {
        setCurrentStatus(candidate.status);
        setAiSummary(candidate.ai_summary || null);
        setNotes(candidate.internal_notes || '');
      }
    } finally {
      setLoading(false);
    }
  }, [candidate]);

  useEffect(() => {
    if (isOpen && candidate) {
      loadDetail(candidate.id);
    } else {
      setDetail(null);
    }
  }, [isOpen, candidate, loadDetail]);

  // Candidate index in list
  const currentIndex = candidatesList.findIndex((c) => c.id === candidate?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < candidatesList.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev && onSelectCandidate) {
      onSelectCandidate(candidatesList[currentIndex - 1]);
    }
  }, [hasPrev, currentIndex, candidatesList, onSelectCandidate]);

  const handleNext = useCallback(() => {
    if (hasNext && onSelectCandidate) {
      onSelectCandidate(candidatesList[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, candidatesList, onSelectCandidate]);

  // Keyboard shortcut listeners (Esc to close, Left/Right arrows to navigate)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in textarea or input
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'textarea' || activeTag === 'input') {
        if (e.key === 'Escape') onClose();
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  if (!candidate) return null;

  // Status Change handler
  const handleStatusChange = async (newStatus: string) => {
    if (!candidate || currentStatus === newStatus || !isAdmin) return;
    try {
      setUpdatingStatus(true);
      setCurrentStatus(newStatus);
      await updateCandidateStatus(candidate.id, newStatus);
      if (onCandidateUpdate) onCandidateUpdate();
    } catch (err) {
      console.error('Failed to update status', err);
      setCurrentStatus(candidate.status);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Quick Score Submit handler
  const handleScoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate) return;
    try {
      setSubmittingScore(true);
      const newScore: Score = await submitScore(candidate.id, {
        category: scoreCategory,
        score: scoreVal,
        note: scoreNote.trim() || undefined,
      });

      if (detail) {
        setDetail({
          ...detail,
          scores: [newScore, ...detail.scores],
        });
      }
      setScoreNote('');
      if (onCandidateUpdate) onCandidateUpdate();
    } catch (err) {
      console.error('Failed to submit score', err);
    } finally {
      setSubmittingScore(false);
    }
  };

  // Generate AI summary handler
  const handleGenerateAI = async () => {
    if (!candidate) return;
    try {
      setGeneratingAi(true);
      const res = await generateAISummary(candidate.id);
      setAiSummary(res.summary);
      if (onCandidateUpdate) onCandidateUpdate();
    } catch (err) {
      console.error('Failed to generate AI summary', err);
    } finally {
      setGeneratingAi(false);
    }
  };

  // Save admin notes handler
  const handleSaveNotes = async () => {
    if (!candidate || !isAdmin) return;
    try {
      setSavingNotes(true);
      await updateCandidateNotes(candidate.id, notes);
      setNotesSavedSuccess(true);
      setTimeout(() => setNotesSavedSuccess(false), 2000);
      if (onCandidateUpdate) onCandidateUpdate();
    } catch (err) {
      console.error('Failed to save notes', err);
    } finally {
      setSavingNotes(false);
    }
  };

  const scores = detail?.scores || [];
  const avgScore =
    scores.length > 0
      ? (scores.reduce((acc, curr) => acc + curr.score, 0) / scores.length).toFixed(1)
      : candidate.average_score !== null && candidate.average_score !== undefined
      ? candidate.average_score.toFixed(1)
      : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`drawer-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`candidate-drawer ${isOpen ? 'open' : ''}`}
        aria-label="Candidate Quick Preview"
      >
        {/* Top Header */}
        <div className="drawer-header">
          <div className="drawer-header-top">
            {candidatesList.length > 0 ? (
              <div className="drawer-nav-counter">
                <button
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  className="drawer-nav-btn"
                  title="Previous candidate (Left Arrow)"
                  aria-label="Previous candidate"
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {currentIndex >= 0 ? currentIndex + 1 : 1} of {candidatesList.length}
                </span>
                <button
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="drawer-nav-btn"
                  title="Next candidate (Right Arrow)"
                  aria-label="Next candidate"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : <div />}

            <div className="drawer-header-actions">
              <button
                onClick={() => navigate(`/candidate/${candidate.id}`)}
                className="drawer-action-btn"
                title="Open full page candidate profile"
              >
                <ExternalLink size={14} />
                <span>Full Profile</span>
              </button>

              <button
                onClick={onClose}
                className="drawer-close-btn"
                title="Close preview (Esc)"
                aria-label="Close preview"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="drawer-candidate-heading">
            <div>
              <h2 className="drawer-candidate-name">{candidate.name}</h2>
              <span className="drawer-candidate-email">{candidate.email}</span>
            </div>
            <span className={`status-badge ${currentStatus}`}>
              {currentStatus}
            </span>
          </div>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="drawer-body">
          {/* Section 1: Quick Meta */}
          <section className="drawer-section">
            <h3 className="drawer-section-title">
              <Briefcase size={14} />
              <span>Position & Application</span>
            </h3>
            <div className="drawer-meta-grid">
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Role Applied</span>
                <p className="drawer-meta-value">{candidate.role_applied}</p>
              </div>
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Applied Date</span>
                <p className="drawer-meta-value">
                  {new Date(candidate.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {candidate.skills && (
              <div style={{ marginTop: '0.875rem' }}>
                <span className="drawer-meta-label" style={{ display: 'block', marginBottom: '0.375rem' }}>
                  Skills
                </span>
                <div className="drawer-skills-list">
                  {candidate.skills.split(',').map((skill, idx) => (
                    <span key={idx} className="drawer-skill-tag">
                      {skill.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Section 2: Quick Status Changer (Admin only) */}
          {isAdmin && (
            <section className="drawer-section">
              <h3 className="drawer-section-title">
                <Calendar size={14} />
                <span>Pipeline Stage</span>
              </h3>
              <div className="status-pill-group">
                {(['new', 'reviewed', 'hired', 'rejected', 'archived'] as const).map((st) => (
                  <button
                    key={st}
                    className={`status-pill-btn ${currentStatus === st ? `active ${st}` : ''}`}
                    onClick={() => handleStatusChange(st)}
                    disabled={updatingStatus}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Section 3: Scores & Quick Evaluation */}
          <section className="drawer-section">
            <h3 className="drawer-section-title">
              <Star size={14} />
              <span>Evaluation & Scoring</span>
            </h3>

            <div className="drawer-score-overview">
              <div className="drawer-score-rating">
                <span className="drawer-score-number">
                  {avgScore ? `★ ${avgScore}` : '--'}
                </span>
                {avgScore && <span className="drawer-score-max">/ 5.0</span>}
              </div>
              <span className="drawer-score-count">
                {scores.length} {scores.length === 1 ? 'evaluation' : 'evaluations'}
              </span>
            </div>

            {loading ? (
              <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>Loading scores...</p>
            ) : scores.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.8125rem', fontStyle: 'italic', margin: '0.5rem 0' }}>
                No category scores submitted yet.
              </p>
            ) : (
              <div className="drawer-scores-list">
                {scores.map((s) => (
                  <div key={s.id} className="drawer-score-item">
                    <div className="drawer-score-item-top">
                      <span className="drawer-score-cat">{s.category}</span>
                      <span className="drawer-score-badge">
                        ★ {s.score} / 5
                      </span>
                    </div>
                    {s.note && <p className="drawer-score-note">"{s.note}"</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Quick Scoring Form */}
            <div className="quick-score-box">
              <h5>Add Quick Score</h5>
              <form onSubmit={handleScoreSubmit} className="quick-score-form">
                <div className="quick-score-row">
                  <select
                    className="quick-score-select"
                    value={scoreCategory}
                    onChange={(e) => setScoreCategory(e.target.value)}
                    disabled={submittingScore}
                  >
                    <option value="Technical Depth">Technical Depth</option>
                    <option value="Communication">Communication</option>
                    <option value="System Architecture">System Architecture</option>
                    <option value="Code Quality">Code Quality</option>
                    <option value="Problem Solving">Problem Solving</option>
                  </select>

                  <div className="quick-star-selector">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        className={`quick-star-btn ${scoreVal === val ? 'active' : ''}`}
                        onClick={() => setScoreVal(val)}
                        disabled={submittingScore}
                      >
                        {val}★
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Optional brief evaluation note..."
                  className="quick-score-input"
                  value={scoreNote}
                  onChange={(e) => setScoreNote(e.target.value)}
                  disabled={submittingScore}
                />

                <button
                  type="submit"
                  className="quick-score-submit-btn"
                  disabled={submittingScore}
                >
                  {submittingScore ? 'Submitting...' : 'Submit Score'}
                </button>
              </form>
            </div>
          </section>

          {/* Section 4: AI Summary */}
          <section className="drawer-section">
            <h3 className="drawer-section-title">
              <Sparkles size={14} style={{ color: '#6366f1' }} />
              <span>AI Candidate Summary</span>
            </h3>

            {aiSummary ? (
              <div>
                <p className="drawer-ai-content">{aiSummary}</p>
                <button
                  onClick={handleGenerateAI}
                  disabled={generatingAi}
                  className="drawer-ai-btn"
                  style={{ marginTop: '0.625rem' }}
                >
                  <Sparkles size={13} />
                  <span>{generatingAi ? 'Regenerating...' : 'Regenerate Summary'}</span>
                </button>
              </div>
            ) : (
              <div className="drawer-ai-empty">
                <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0 }}>
                  Generate an AI assessment aggregating qualifications and review ratings.
                </p>
                <button
                  onClick={handleGenerateAI}
                  disabled={generatingAi}
                  className="drawer-ai-btn"
                >
                  <Sparkles size={13} />
                  <span>{generatingAi ? 'Generating...' : 'Generate AI Summary'}</span>
                </button>
              </div>
            )}
          </section>

          {/* Section 5: Internal Admin Notes */}
          {isAdmin && (
            <section className="drawer-section">
              <h3 className="drawer-section-title">
                <Lock size={14} />
                <span>Internal Notes (Admin Only)</span>
              </h3>
              <textarea
                className="drawer-notes-textarea"
                rows={3}
                placeholder="Interview observations, compensation expectations, team fit notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={savingNotes}
              />
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="drawer-notes-save-btn"
              >
                {notesSavedSuccess ? <Check size={14} /> : <Save size={14} />}
                <span>{savingNotes ? 'Saving...' : notesSavedSuccess ? 'Saved!' : 'Save Notes'}</span>
              </button>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="drawer-footer">
          <button
            onClick={() => navigate(`/candidate/${candidate.id}`)}
            className="btn-drawer-full-profile"
          >
            <ExternalLink size={15} />
            <span>Open Full Profile</span>
          </button>

          {isAdmin && onOpenArchiveModal && (
            <button
              onClick={() => onOpenArchiveModal(candidate)}
              className="btn-drawer-archive"
              title="Archive Candidate"
            >
              <Archive size={15} />
              <span>Archive</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
