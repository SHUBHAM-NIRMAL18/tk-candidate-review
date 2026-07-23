import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import '../styles/Toast.css';

interface ToastProps {
  title: string;
  message: string;
  type?: 'success' | 'error';
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ title, message, type = 'success', onClose }) => {
  return (
    <div className={`toast-notification ${type}`}>
      <div className="toast-icon">
        {type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
      </div>
      <div className="toast-content">
        <h4 className="toast-title">{title}</h4>
        <p className="toast-message">{message}</p>
      </div>
      {onClose && (
        <button className="toast-close-btn" onClick={onClose} aria-label="Close notification">
          <X size={14} />
        </button>
      )}
      <div className="toast-progress">
        <div className="toast-progress-fill" />
      </div>
    </div>
  );
};
