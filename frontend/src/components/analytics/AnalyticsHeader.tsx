import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, BarChart3, Shield, RefreshCw, LogOut } from 'lucide-react';
import type { User } from '../../types/auth';

interface AnalyticsHeaderProps {
  user: User | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onRequestLogout: () => void;
}

export const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({
  user,
  loading,
  refreshing,
  onRefresh,
  onRequestLogout,
}) => {
  const navigate = useNavigate();

  return (
    <header className="analytics-header">
      <div className="analytics-top-bar">
        <div className="brand-section">
          <img
            src="/TechKraft-Logo.svg"
            alt="TechKraft Logo"
            className="dashboard-logo"
            style={{ height: '18px', width: 'auto', display: 'block' }}
          />
          <span className="brand-title">Candidate Review Dashboard</span>
        </div>

        <div className="nav-tabs">
          <button
            type="button"
            className="nav-tab-btn"
            onClick={() => navigate('/')}
          >
            <Users size={15} />
            <span>Candidates</span>
          </button>
          <button
            type="button"
            className="nav-tab-btn active"
            onClick={() => {}}
          >
            <BarChart3 size={15} />
            <span>Analytics</span>
          </button>
        </div>

        <div className="user-profile-controls">
          <div className={`user-role-badge ${user?.role || 'reviewer'}`}>
            <Shield size={12} />
            <span>{user?.role}</span>
          </div>
          <span className="user-email-text">{user?.email}</span>
          <button
            type="button"
            className="header-action-btn refresh-btn"
            onClick={onRefresh}
            disabled={refreshing || loading}
            title="Refresh metrics"
          >
            <RefreshCw size={14} className={refreshing ? 'loading-spinner' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="header-action-btn logout-btn"
            onClick={onRequestLogout}
            title="Sign Out"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="analytics-title-banner">
        <div>
          <h1 className="banner-heading">Hiring Pipeline & Evaluation Analytics</h1>
          <p className="banner-subheading">
            Real-time intelligence across candidate throughput, score distribution, and evaluation benchmarks.
          </p>
        </div>
      </div>
    </header>
  );
};
