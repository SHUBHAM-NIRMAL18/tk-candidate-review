import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import {
  LogOut,
  Users,
  FileCheck,
  Star,
  Shield,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Archive,
  ExternalLink
} from 'lucide-react';
import { fetchCandidates, createCandidate, softDeleteCandidate } from '../api/candidate';
import type { Candidate, CandidateCreateInput } from '../types/candidate';
import { ConfirmModal } from '../components/ConfirmModal';
import { AddCandidateModal } from '../components/AddCandidateModal';
import { Toast } from '../components/Toast';
import { consumeToast, type ToastData } from '../utils/toast';
import '../styles/DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [archiveCandidateTarget, setArchiveCandidateTarget] = useState<Candidate | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    const pendingToast = consumeToast();
    if (pendingToast) {
      setToast(pendingToast);
    }
  }, []);

  const loadCandidates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchCandidates({
        status: statusFilter || undefined,
        role_applied: roleFilter || undefined,
        skill: skillFilter || undefined,
        keyword: keywordInput || undefined,
        page,
        page_size: pageSize,
      });
      setCandidates(res.items);
      setTotal(res.total);
      setTotalPages(res.pages);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch candidates';
      setToast({ title: 'Error', message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, roleFilter, skillFilter, keywordInput, page, pageSize]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const handleCreateCandidate = async (input: CandidateCreateInput) => {
    await createCandidate(input);
    setToast({
      title: 'Candidate Created',
      message: `Candidate "${input.name}" has been added successfully.`,
      type: 'success',
    });
    setPage(1);
    loadCandidates();
  };

  const handleConfirmArchive = async () => {
    if (!archiveCandidateTarget) return;
    try {
      setIsArchiving(true);
      await softDeleteCandidate(archiveCandidateTarget.id);
      setToast({
        title: 'Candidate Archived',
        message: `Candidate "${archiveCandidateTarget.name}" status updated to archived.`,
        type: 'success',
      });
      setArchiveCandidateTarget(null);
      loadCandidates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to archive candidate';
      setToast({ title: 'Error', message: msg, type: 'error' });
    } finally {
      setIsArchiving(false);
    }
  };

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

      {archiveCandidateTarget && (
        <ConfirmModal
          title="Archive Candidate"
          message={`Are you sure you want to archive "${archiveCandidateTarget.name}"? Status will be updated to "archived".`}
          confirmLabel="Archive Candidate"
          cancelLabel="Cancel"
          loading={isArchiving}
          onConfirm={handleConfirmArchive}
          onCancel={() => setArchiveCandidateTarget(null)}
        />
      )}

      <AddCandidateModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleCreateCandidate}
        userRole={user?.role}
      />

      <header className="dashboard-header">
        <div className="header-left">
          <img src="/TechKraft-Logo.svg" alt="TechKraft Logo" className="dashboard-logo" />
          <span className="app-title">Candidate Review Dashboard</span>
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
              Signed in with <strong>{user?.role}</strong> role. Manage candidate evaluations, category scores, and AI summary reports below.
            </p>
          </div>

          <button onClick={() => setShowAddModal(true)} className="btn-add-candidate">
            <Plus size={18} />
            <span>Add Candidate</span>
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrapper primary">
              <Users size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{total}</span>
              <span className="stat-label">Active Candidates</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper warning">
              <FileCheck size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">
                {candidates.filter((c) => c.status === 'new').length}
              </span>
              <span className="stat-label">New Submissions</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper success">
              <Star size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">
                {candidates.filter((c) => c.status === 'hired').length}
              </span>
              <span className="stat-label">Hired Candidates</span>
            </div>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3>Candidate Directory</h3>

            <div className="filter-controls-group">
              <div className="search-box">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search name, email, skills..."
                  value={keywordInput}
                  onChange={(e) => {
                    setKeywordInput(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <select
                className="select-filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Statuses</option>
                <option value="new">New</option>
                <option value="reviewed">Reviewed</option>
                <option value="hired">Hired</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>

              <input
                type="text"
                className="input-filter-sm"
                placeholder="Role..."
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
              />

              <input
                type="text"
                className="input-filter-sm"
                placeholder="Skill..."
                value={skillFilter}
                onChange={(e) => {
                  setSkillFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {loading ? (
            <div className="table-loading">
              <div className="spinner-lg" />
              <p>Loading Candidates...</p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="table-empty">
              <p>No candidates found matching the selected filters.</p>
            </div>
          ) : (
            <table className="candidate-table">
              <thead>
                <tr>
                  <th>Candidate Name</th>
                  <th>Role Applied</th>
                  <th>Status</th>
                  <th>Skills</th>
                  <th>Avg Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((cand) => (
                  <tr
                    key={cand.id}
                    onClick={() => navigate(`/candidate/${cand.id}`)}
                    className="clickable-row"
                  >
                    <td>
                      <div className="candidate-cell">
                        <strong className="candidate-name-link">{cand.name}</strong>
                        <span className="candidate-email">{cand.email}</span>
                      </div>
                    </td>
                    <td>{cand.role_applied}</td>
                    <td>
                      <span className={`status-badge ${cand.status}`}>
                        {cand.status}
                      </span>
                    </td>
                    <td>
                      <div className="skill-badges">
                        {cand.skills
                          ? cand.skills.split(',').slice(0, 3).map((s, idx) => (
                              <span key={idx} className="mini-skill-badge">
                                {s.trim()}
                              </span>
                            ))
                          : '—'}
                      </div>
                    </td>
                    <td>
                      <strong className="candidate-score-pill">
                        {cand.average_score !== null && cand.average_score !== undefined
                          ? `★ ${cand.average_score}`
                          : '--'}
                      </strong>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="action-buttons">
                        <button
                          onClick={() => navigate(`/candidate/${cand.id}`)}
                          className="action-btn view-btn"
                        >
                          <ExternalLink size={14} />
                          <span>Review</span>
                        </button>

                        <button
                          onClick={() => setArchiveCandidateTarget(cand)}
                          className="action-btn archive-icon-btn"
                          title="Archive Candidate"
                        >
                          <Archive size={14} />
                          <span>Archive</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="pagination-bar">
            <span className="pagination-info">
              Showing page {page} of {totalPages} ({total} candidates)
            </span>

            <div className="pagination-controls-right">
              <div className="page-size-wrap">
                <span>Page size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="pagination-buttons">
                <button
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => p - 1)}
                  className="pagination-btn"
                >
                  <ChevronLeft size={16} />
                  <span>Prev</span>
                </button>
                <button
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="pagination-btn"
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
