import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { LogOut, Users, FileCheck, Star, Shield, Search } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';
import { consumeToast, type ToastData } from '../utils/toast';
import '../styles/DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    // Consume Login Successfully toast when arriving at Dashboard
    const pendingToast = consumeToast();
    if (pendingToast) {
      setToast(pendingToast);
    }
  }, []);

  const handleConfirmLogout = async () => {
    try {
      setIsLoggingOut(true);
      setShowLogoutModal(false);
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="dashboard-layout">
      {toast && (
        <Toast
          title={toast.title}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {showLogoutModal && (
        <ConfirmModal
          title="Confirm Logout"
          message="Are you sure you want to log out of your session?"
          confirmLabel="Logout"
          cancelLabel="Cancel"
          loading={isLoggingOut}
          onConfirm={handleConfirmLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}

      <header className="dashboard-header">
        <div className="header-left">
          <img src="/TechKraft-Logo.svg" alt="TechKraft Logo" className="dashboard-logo" />
          <span className="app-title">Candidate Review</span>
        </div>

        <div className="header-right">
          <div className="user-info">
            <span className="user-email">{user?.email}</span>
            <span className={`role-badge ${user?.role}`}>
              <Shield size={12} />
              {user?.role}
            </span>
          </div>

          <button 
            onClick={() => setShowLogoutModal(true)} 
            className="logout-btn" 
            title="Sign Out"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="welcome-banner">
          <div>
            <h1>Welcome, {user?.email}!</h1>
            <p>
              You are signed in with the <strong>{user?.role}</strong> role. Manage candidate evaluations and score submissions below.
            </p>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrapper primary">
              <Users size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">12</span>
              <span className="stat-label">Active Candidates</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper warning">
              <FileCheck size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">5</span>
              <span className="stat-label">Pending Reviews</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper success">
              <Star size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">4.2 / 5</span>
              <span className="stat-label">Average Score</span>
            </div>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3>Recent Candidates</h3>
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input type="text" placeholder="Search candidate..." disabled />
            </div>
          </div>

          <table className="candidate-table">
            <thead>
              <tr>
                <th>Candidate Name</th>
                <th>Role Applied</th>
                <th>Status</th>
                <th>Skills</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Alex Rivera</strong></td>
                <td>Senior Frontend Engineer</td>
                <td><span className="status-badge Under_Review">Under Review</span></td>
                <td>React, TypeScript, CSS</td>
                <td><button className="action-btn">Evaluate Score</button></td>
              </tr>
              <tr>
                <td><strong>Jordan Smith</strong></td>
                <td>Backend Developer</td>
                <td><span className="status-badge Applied">Applied</span></td>
                <td>Python, FastAPI, SQLite</td>
                <td><button className="action-btn">Evaluate Score</button></td>
              </tr>
              <tr>
                <td><strong>Taylor Morgan</strong></td>
                <td>Fullstack Engineer</td>
                <td><span className="status-badge Hired">Hired</span></td>
                <td>Node.js, React, Docker</td>
                <td><button className="action-btn">View Details</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};
