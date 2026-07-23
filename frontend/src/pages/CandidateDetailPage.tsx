import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { ArrowLeft } from 'lucide-react';
import {
  fetchCandidateById,
  submitScore,
  generateAISummary,
  softDeleteCandidate,
  updateCandidateNotes,
  updateCandidateStatus
} from '../api/candidate';
import type { CandidateDetail } from '../types/candidate';
import { CandidateProfileCard } from '../components/CandidateProfileCard';
import { AISummaryCard } from '../components/AISummaryCard';
import { CandidateScoresCard } from '../components/CandidateScoresCard';
import { AdminNotesCard } from '../components/AdminNotesCard';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';
import { triggerToast } from '../utils/toast';
import '../styles/CandidateDetail.css';

export const CandidateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [toast, setToast] = useState<{ title: string; message: string; type: 'success' | 'error' } | null>(null);

  const loadCandidateData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await fetchCandidateById(id);
      setCandidate(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load candidate profile');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCandidateData();
  }, [loadCandidateData]);

  useEffect(() => {
    if (!id) return;
    const eventSource = new EventSource(`/api/v1/candidates/${id}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const newScore = JSON.parse(event.data);
        setCandidate((prev) => {
          if (!prev) return prev;
          if (prev.scores.some((s) => s.id === newScore.id)) return prev;
          return {
            ...prev,
            scores: [newScore, ...prev.scores],
          };
        });
      } catch {
      }
    };

    return () => {
      eventSource.close();
    };
  }, [id]);

  const handleScoreSubmit = async (category: string, score: number, note: string) => {
    if (!id) return;
    try {
      await submitScore(id, { category, score, note: note.trim() || undefined });
      setToast({
        title: 'Score Submitted',
        message: `Submitted score ${score}/5 for ${category}`,
        type: 'success',
      });
      loadCandidateData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit score';
      setToast({ title: 'Error', message: msg, type: 'error' });
    }
  };

  const handleGenerateAISummary = async () => {
    if (!id) return;
    try {
      setAiState('loading');
      setAiErrorMsg(null);
      const res = await generateAISummary(id);
      setCandidate((prev) => (prev ? { ...prev, ai_summary: res.summary } : prev));
      setAiState('idle');
      setToast({
        title: 'AI Summary Ready',
        message: 'Generated candidate evaluation summary.',
        type: 'success',
      });
    } catch (err: unknown) {
      setAiErrorMsg(err instanceof Error ? err.message : 'Failed to generate summary');
      setAiState('error');
    }
  };

  const handleSaveNotes = async (notesText: string) => {
    if (!id) return;
    try {
      const updated = await updateCandidateNotes(id, notesText);
      setCandidate((prev) => (prev ? { ...prev, internal_notes: updated.internal_notes } : prev));
      setToast({
        title: 'Internal Notes Saved',
        message: 'Saved updated candidate internal notes.',
        type: 'success',
      });
    } catch (err: unknown) {
      setToast({ title: 'Error', message: err instanceof Error ? err.message : 'Failed to save notes', type: 'error' });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    try {
      const updated = await updateCandidateStatus(id, newStatus);
      setCandidate((prev) => (prev ? { ...prev, status: updated.status } : prev));
      setToast({
        title: 'Status Updated',
        message: `Candidate status updated to "${newStatus}".`,
        type: 'success',
      });
    } catch (err: unknown) {
      setToast({ title: 'Error', message: err instanceof Error ? err.message : 'Failed to update status', type: 'error' });
    }
  };

  const handleArchiveCandidate = async () => {
    if (!id) return;
    try {
      setArchiving(true);
      await softDeleteCandidate(id);
      setShowArchiveModal(false);
      triggerToast('Candidate Archived', `Candidate ${candidate?.name} set to archived.`, 'success');
      navigate('/');
    } catch (err: unknown) {
      setToast({ title: 'Error', message: err instanceof Error ? err.message : 'Failed to archive candidate', type: 'error' });
    } finally {
      setArchiving(false);
    }
  };

  if (loading) {
    return (
      <div className="detail-loading-screen">
        <div className="spinner-lg" />
        <p>Loading Candidate Details...</p>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="detail-error-container">
        <h2>Candidate Not Found</h2>
        <p>{error || 'The requested candidate profile could not be loaded.'}</p>
        <button onClick={() => navigate('/')} className="btn-primary">
          <ArrowLeft size={16} />
          <span>Back to list</span>
        </button>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="detail-layout">
      {toast && (
        <Toast
          title={toast.title}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {showArchiveModal && (
        <ConfirmModal
          title="Archive Candidate"
          message={`Are you sure you want to archive "${candidate.name}"? Status will be updated to "archived".`}
          confirmLabel="Archive Candidate"
          cancelLabel="Cancel"
          loading={archiving}
          onConfirm={handleArchiveCandidate}
          onCancel={() => setShowArchiveModal(false)}
        />
      )}

      <header className="detail-header">
        <button onClick={() => navigate('/')} className="back-btn">
          <ArrowLeft size={18} />
          <span>Back to Dashboard</span>
        </button>

        <div className="candidate-header-title">
          <h1>{candidate.name}</h1>
          <span className={`status-badge ${candidate.status}`}>
            {candidate.status}
          </span>
        </div>
      </header>

      <div className="detail-grid">
        <CandidateProfileCard candidate={candidate} />

        <AISummaryCard
          summary={candidate.ai_summary}
          aiState={aiState}
          aiErrorMsg={aiErrorMsg}
          onGenerate={handleGenerateAISummary}
        />

        <CandidateScoresCard
          scores={candidate.scores}
          isAdmin={isAdmin}
          onScoreSubmit={handleScoreSubmit}
        />

        {isAdmin && (
          <AdminNotesCard
            initialNotes={candidate.internal_notes}
            initialStatus={candidate.status}
            onSaveNotes={handleSaveNotes}
            onStatusChange={handleStatusChange}
            onOpenArchiveModal={() => setShowArchiveModal(true)}
          />
        )}
      </div>
    </div>
  );
};
