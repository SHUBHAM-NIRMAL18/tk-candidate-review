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

interface FieldErrors {
  name?: string;
  email?: string;
  roleApplied?: string;
  form?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [errors, setErrors] = useState<FieldErrors>({});

  if (!isOpen) return null;

  const validateForm = (): boolean => {
    const newErrors: FieldErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Full name is required.';
    }

    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address (e.g. alex@example.com).';
    }

    if (!roleApplied.trim()) {
      newErrors.roleApplied = 'Role applied is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm()) {
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
        setErrors({ form: err.message });
      } else {
        setErrors({ form: 'Failed to create candidate' });
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

        <form onSubmit={handleSubmit} className="modal-body" noValidate>
          {errors.form && <div className="form-error">{errors.form}</div>}

          <div className="form-group">
            <label htmlFor="cand-name">
              Full Name <span className="required-asterisk">*</span>
            </label>
            <input
              id="cand-name"
              type="text"
              placeholder="e.g. Alex Rivera"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              className={errors.name ? 'input-error' : ''}
              disabled={loading}
            />
            {errors.name && <span className="field-error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="cand-email">
              Email Address <span className="required-asterisk">*</span>
            </label>
            <input
              id="cand-email"
              type="email"
              placeholder="e.g. alex.rivera@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              className={errors.email ? 'input-error' : ''}
              disabled={loading}
            />
            {errors.email && <span className="field-error-text">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="cand-role">
              Role Applied <span className="required-asterisk">*</span>
            </label>
            <input
              id="cand-role"
              type="text"
              placeholder="e.g. Full Stack Engineer"
              value={roleApplied}
              onChange={(e) => {
                setRoleApplied(e.target.value);
                if (errors.roleApplied) setErrors((prev) => ({ ...prev, roleApplied: undefined }));
              }}
              className={errors.roleApplied ? 'input-error' : ''}
              disabled={loading}
            />
            {errors.roleApplied && <span className="field-error-text">{errors.roleApplied}</span>}
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
