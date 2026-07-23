import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle2, Archive } from 'lucide-react';

interface AdminNotesCardProps {
  initialNotes?: string | null;
  initialStatus: string;
  onSaveNotes: (notes: string) => Promise<void>;
  onStatusChange: (status: string) => Promise<void>;
  onOpenArchiveModal: () => void;
}

export const AdminNotesCard: React.FC<AdminNotesCardProps> = ({
  initialNotes,
  initialStatus,
  onSaveNotes,
  onStatusChange,
  onOpenArchiveModal,
}) => {
  const [notesText, setNotesText] = useState(initialNotes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    setNotesText(initialNotes || '');
  }, [initialNotes]);

  useEffect(() => {
    setCurrentStatus(initialStatus);
  }, [initialStatus]);

  const handleSave = async () => {
    try {
      setSavingNotes(true);
      await onSaveNotes(notesText);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleStatusSelect = async (newStatus: string) => {
    try {
      setUpdatingStatus(true);
      setCurrentStatus(newStatus);
      await onStatusChange(newStatus);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="detail-card admin-notes-card">
      <div className="card-header admin-header">
        <div className="admin-title-wrap">
          <Lock size={16} />
          <h3>🔒 INTERNAL NOTES (admin only)</h3>
        </div>
      </div>

      <div className="admin-notes-content">
        <textarea
          rows={4}
          value={notesText}
          onChange={(e) => setNotesText(e.target.value)}
          placeholder="Salary expectation, culture fit, interview feedback..."
          disabled={savingNotes}
        />

        <div className="admin-card-actions">
          <div className="status-dropdown-wrap">
            <label>Status:</label>
            <select
              value={currentStatus}
              onChange={(e) => handleStatusSelect(e.target.value)}
              disabled={updatingStatus}
            >
              <option value="new">New</option>
              <option value="reviewed">Reviewed</option>
              <option value="hired">Hired</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="admin-button-group">
            <button
              onClick={handleSave}
              className="btn-save-notes"
              disabled={savingNotes}
            >
              <CheckCircle2 size={16} />
              <span>{savingNotes ? 'Saving...' : 'Save Notes'}</span>
            </button>

            <button
              onClick={onOpenArchiveModal}
              className="btn-archive-admin"
            >
              <Archive size={16} />
              <span>Archive Candidate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
