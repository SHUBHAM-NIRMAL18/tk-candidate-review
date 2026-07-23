import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import '../styles/ConfirmModal.css';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <div
      className="confirm-modal-overlay modal-overlay"
      onClick={onCancel}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        className="confirm-modal-card modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          position: 'relative',
          padding: '2rem 1.75rem 1.75rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          border: '1px solid #e2e8f0',
        }}
      >
        <button
          className="confirm-close-btn modal-close-btn"
          onClick={onCancel}
          disabled={loading}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '0.875rem',
            right: '0.875rem',
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '0.375rem',
            borderRadius: '6px',
          }}
        >
          <X size={18} />
        </button>

        <div
          className="confirm-icon-wrapper icon-wrapper warning"
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#fef3c7',
            color: '#d97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={28} />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
          {title}
        </h3>

        <p style={{ fontSize: '0.9375rem', color: '#64748b', margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>
          {message}
        </p>

        <div
          className="confirm-modal-actions modal-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            width: '100%',
          }}
        >
          <button
            className="confirm-cancel-btn cancel-btn"
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.6875rem 1.25rem',
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelLabel}
          </button>

          <button
            className="confirm-submit-btn confirm-btn danger"
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.6875rem 1.25rem',
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
