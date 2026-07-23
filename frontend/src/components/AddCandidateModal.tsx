import React, { useState } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';
import type { CandidateCreateInput } from '../types/candidate';
import '../styles/Modal.css';

interface AddCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CandidateCreateInput) => Promise<void>;
  userRole?: string;
}

export const AddCandidateModal: React.FC<AddCandidateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  userRole
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleApplied, setRoleApplied] = useState('');
  const [skills, setSkills] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !roleApplied.trim()) {
      setError('Name, email, and role applied are required.');
      return;
    }

    try {
      setLoading(true);
      await onSubmit({
        name: name.trim(),
        email: email.trim(),
        role_applied: roleApplied.trim(),
        skills: skills.trim() || undefined,
        internal_notes: internalNotes.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create candidate');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <UserPlus size={20} className="modal-icon" />
            <h3>Add New Candidate</h3>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="cand-name">Full Name *</label>
            <input
              id="cand-name"
              type="text"
              placeholder="e.g. Alex Rivera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="cand-email">Email Address *</label>
            <input
              id="cand-email"
              type="email"
              placeholder="e.g. alex.rivera@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="cand-role">Role Applied *</label>
            <input
              id="cand-role"
              type="text"
              placeholder="e.g. Full Stack Engineer"
              value={roleApplied}
              onChange={(e) => setRoleApplied(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="cand-skills">Skills (Comma-separated)</label>
            <input
              id="cand-skills"
              type="text"
              placeholder="e.g. Python, FastAPI, React, Docker"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              disabled={loading}
            />
          </div>

          {userRole === 'admin' && (
            <div className="form-group">
              <label htmlFor="cand-notes">Internal Notes (Admin Only)</label>
              <textarea
                id="cand-notes"
                rows={3}
                placeholder="Private evaluation notes visible only to admins..."
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  <span>Saving...</span>
                </>
              ) : (
                'Create Candidate'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
