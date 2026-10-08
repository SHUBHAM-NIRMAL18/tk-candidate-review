import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ExternalLink,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  BarChart3,
  KeyRound,
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileCode,
  RotateCcw,
  SearchX,
  Eye,
} from 'lucide-react';
import { fetchCandidates, createCandidate, softDeleteCandidate } from '../api/candidate';
import { getExportCsvUrl, getExportJsonUrl } from '../api/integrations';
import type { Candidate, CandidateCreateInput } from '../types/candidate';
import { ConfirmModal } from '../components/ConfirmModal';
import { AddCandidateModal } from '../components/AddCandidateModal';
import { IntegrationsModal } from '../components/IntegrationsModal';
import { CandidateDrawer } from '../components/CandidateDrawer';
import { Toast } from '../components/Toast';
import { consumeToast, type ToastData } from '../utils/toast';
import '../styles/DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

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
  const [sortBy, setSortBy] = useState<string>('average_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Phase 1: Slide-out drawer state
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Phase 1: Direct table export dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);
  const [archiveCandidateTarget, setArchiveCandidateTarget] = useState<Candidate | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  // Click outside to dismiss export menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        sort_by: sortBy || undefined,
        sort_order: sortOrder || undefined,
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
  }, [statusFilter, roleFilter, skillFilter, keywordInput, sortBy, sortOrder, page, pageSize]);

  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(columnKey);
      setSortOrder(columnKey === 'average_score' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const renderSortHeader = (label: string, columnKey: string) => {
    const isActive = sortBy === columnKey;
    return (
      <th
        className={`sortable-th ${isActive ? 'active-sort' : ''}`}
        onClick={() => handleSort(columnKey)}
        title={`Click to sort by ${label}`}
      >
        <div className="sort-header-content">
          <span>{label}</span>
          {isActive ? (
            sortOrder === 'asc' ? (
              <ArrowUp size={14} className="sort-icon active" />
            ) : (
              <ArrowDown size={14} className="sort-icon active" />
            )
          ) : (
            <ArrowUpDown size={14} className="sort-icon default" />
          )}
        </div>
      </th>
    );
  };

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

  const handleOpenDrawer = (cand: Candidate) => {
    setSelectedCandidate(cand);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  const handleResetFilters = () => {
    setKeywordInput('');
    setStatusFilter('');
    setRoleFilter('');
    setSkillFilter('');
    setPage(1);
  };

  const handleTriggerExport = (format: 'csv' | 'json') => {
    setShowExportMenu(false);
    const url =
      format === 'csv'
        ? getExportCsvUrl(statusFilter || undefined)
        : getExportJsonUrl(statusFilter || undefined);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToast({
      title: 'Export Started',
      message: `Downloading ${format.toUpperCase()} export${statusFilter ? ` for status: "${statusFilter}"` : ''}...`,
      type: 'success',
    });
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

      <IntegrationsModal
        isOpen={showIntegrationsModal}
        onClose={() => setShowIntegrationsModal(false)}
      />

      <CandidateDrawer
        candidate={selectedCandidate}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        userRole={user?.role}
        onCandidateUpdate={loadCandidates}
        candidatesList={candidates}
        onSelectCandidate={(cand) => setSelectedCandidate(cand)}
        onOpenArchiveModal={(cand) => setArchiveCandidateTarget(cand)}
      />

      <header className="dashboard-header">
        <div className="header-left">
          <img src="/TechKraft-Logo.svg" alt="TechKraft Logo" className="dashboard-logo" style={{ height: '18px', width: 'auto', display: 'block' }} />
          <span className="app-title">Candidate Review Dashboard</span>
        </div>

        <div className="nav-tabs">
          <button
            className="nav-tab-btn active"
            onClick={() => {}}
          >
            <Users size={15} />
            <span>Candidates</span>
          </button>
          <button
            className="nav-tab-btn"
            onClick={() => navigate('/analytics')}
          >
            <BarChart3 size={15} />
            <span>Analytics</span>
          </button>
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

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {isAdmin && (
              <button
                onClick={() => setShowIntegrationsModal(true)}
                className="btn-add-candidate"
                style={{ background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}
                title="Manage API Keys & Webhooks"
              >
                <KeyRound size={18} style={{ color: '#4f46e5' }} />
                <span>Integrations & API</span>
              </button>
            )}
            <button onClick={() => setShowAddModal(true)} className="btn-add-candidate">
              <Plus size={18} />
              <span>Add Candidate</span>
            </button>
          </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Candidate Directory</h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#64748b',
                  backgroundColor: '#f1f5f9',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                }}
              >
                {total} total
              </span>
            </div>

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

              <select
                className="select-filter"
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order as 'asc' | 'desc');
                  setPage(1);
                }}
              >
                <option value="average_score-desc">Sort: Highest Score</option>
                <option value="average_score-asc">Sort: Lowest Score</option>
                <option value="name-asc">Sort: Name (A-Z)</option>
                <option value="name-desc">Sort: Name (Z-A)</option>
                <option value="role_applied-asc">Sort: Role (A-Z)</option>
                <option value="role_applied-desc">Sort: Role (Z-A)</option>
                <option value="status-asc">Sort: Status (A-Z)</option>
                <option value="status-desc">Sort: Status (Z-A)</option>
                <option value="created_at-desc">Sort: Newest First</option>
                <option value="created_at-asc">Sort: Oldest First</option>
              </select>

              {/* Direct Export Dropdown */}
              <div className="export-dropdown-wrapper" ref={exportMenuRef}>
                <button
                  type="button"
                  className="btn-export-dropdown"
                  onClick={() => setShowExportMenu((prev) => !prev)}
                  title="Export Candidates"
                >
                  <Download size={14} />
                  <span>Export</span>
                  <ChevronDown
                    size={13}
                    className={`chevron-export ${showExportMenu ? 'open' : ''}`}
                  />
                </button>

                {showExportMenu && (
                  <div className="export-menu-dropdown">
                    <div className="export-menu-header">Export Candidate Records</div>
                    <button
                      type="button"
                      className="export-menu-item"
                      onClick={() => handleTriggerExport('csv')}
                    >
                      <FileSpreadsheet
                        size={16}
                        style={{ color: '#059669', flexShrink: 0, marginTop: '2px' }}
                      />
                      <div>
                        <strong>Export as CSV</strong>
                        <span>Formatted spreadsheet for Excel & Google Sheets</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="export-menu-item"
                      onClick={() => handleTriggerExport('json')}
                    >
                      <FileCode
                        size={16}
                        style={{ color: '#2563eb', flexShrink: 0, marginTop: '2px' }}
                      />
                      <div>
                        <strong>Export as JSON</strong>
                        <span>Structured data payloads with nested scores</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <>
              {/* Shimmer Skeleton Desktop Table */}
              <div className="desktop-table-view">
                <table className="candidate-table">
                  <thead>
                    <tr>
                      {renderSortHeader('Candidate Name', 'name')}
                      {renderSortHeader('Role Applied', 'role_applied')}
                      {renderSortHeader('Status', 'status')}
                      <th>Skills</th>
                      {renderSortHeader('Avg Score', 'average_score')}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <tr key={idx} className="skeleton-row">
                        <td>
                          <div className="skeleton-name-box">
                            <div className="skeleton-shimmer skeleton-line title" />
                            <div className="skeleton-shimmer skeleton-line sub" />
                          </div>
                        </td>
                        <td>
                          <div
                            className="skeleton-shimmer skeleton-line title"
                            style={{ margin: '0 auto', width: 95 }}
                          />
                        </td>
                        <td>
                          <div className="skeleton-shimmer skeleton-line badge" />
                        </td>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              gap: '0.25rem',
                              justifyContent: 'center',
                            }}
                          >
                            <div className="skeleton-shimmer skeleton-line pill" />
                            <div
                              className="skeleton-shimmer skeleton-line pill"
                              style={{ width: 44 }}
                            />
                          </div>
                        </td>
                        <td>
                          <div className="skeleton-shimmer skeleton-line score" />
                        </td>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              gap: '0.375rem',
                              justifyContent: 'center',
                            }}
                          >
                            <div
                              className="skeleton-shimmer skeleton-line btn"
                              style={{ width: 54 }}
                            />
                            <div
                              className="skeleton-shimmer skeleton-line btn"
                              style={{ width: 54 }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Shimmer Skeleton Mobile Cards */}
              <div className="mobile-candidate-cards">
                {[1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className="mobile-candidate-card"
                    style={{ gap: '0.75rem' }}
                  >
                    <div
                      className="skeleton-shimmer skeleton-line title"
                      style={{ width: '45%' }}
                    />
                    <div
                      className="skeleton-shimmer skeleton-line sub"
                      style={{ width: '65%' }}
                    />
                    <div
                      className="skeleton-shimmer skeleton-line score"
                      style={{ width: 75, margin: 0 }}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : candidates.length === 0 ? (
            <div className="table-empty-box">
              <div className="empty-icon-wrapper">
                <SearchX size={26} />
              </div>
              <h4>No candidates found</h4>
              <p>
                {keywordInput || statusFilter || roleFilter || skillFilter
                  ? 'No candidate profiles matched your active filters or search terms.'
                  : 'There are no active candidate records available in the directory.'}
              </p>
              {(keywordInput || statusFilter || roleFilter || skillFilter) && (
                <button onClick={handleResetFilters} className="btn-reset-filters">
                  <RotateCcw size={14} />
                  <span>Clear All Filters</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="desktop-table-view">
                <table className="candidate-table">
                  <thead>
                    <tr>
                      {renderSortHeader('Candidate Name', 'name')}
                      {renderSortHeader('Role Applied', 'role_applied')}
                      {renderSortHeader('Status', 'status')}
                      <th>Skills</th>
                      {renderSortHeader('Avg Score', 'average_score')}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((cand) => (
                      <tr
                        key={cand.id}
                        onClick={() => handleOpenDrawer(cand)}
                        className={`clickable-row ${
                          selectedCandidate?.id === cand.id && isDrawerOpen
                            ? 'selected-row-active'
                            : ''
                        }`}
                        title="Click to preview candidate profile"
                      >
                        <td data-label="Candidate">
                          <div className="candidate-cell">
                            <strong className="candidate-name-link">{cand.name}</strong>
                            <span className="candidate-email">{cand.email}</span>
                          </div>
                        </td>
                        <td data-label="Role Applied">{cand.role_applied}</td>
                        <td data-label="Status">
                          <span className={`status-badge ${cand.status}`}>
                            {cand.status}
                          </span>
                        </td>
                        <td data-label="Skills">
                          <div className="skill-badges">
                            {cand.skills
                              ? cand.skills
                                  .split(',')
                                  .slice(0, 3)
                                  .map((s, idx) => (
                                    <span key={idx} className="mini-skill-badge">
                                      {s.trim()}
                                    </span>
                                  ))
                              : '—'}
                          </div>
                        </td>
                        <td data-label="Avg Score">
                          <strong className="candidate-score-pill">
                            {cand.average_score !== null && cand.average_score !== undefined
                              ? `★ ${cand.average_score}`
                              : '--'}
                          </strong>
                        </td>
                        <td data-label="Actions" onClick={(e) => e.stopPropagation()}>
                          <div className="action-buttons">
                            <button
                              onClick={() => handleOpenDrawer(cand)}
                              className="action-btn peek-btn"
                              title="Quick Preview Drawer"
                            >
                              <Eye size={14} />
                              <span>Peek</span>
                            </button>

                            <button
                              onClick={() => navigate(`/candidate/${cand.id}`)}
                              className="action-btn view-btn"
                              title="Open Full Profile Page"
                            >
                              <ExternalLink size={14} />
                              <span>Review</span>
                            </button>

                            {isAdmin && (
                              <button
                                onClick={() => setArchiveCandidateTarget(cand)}
                                className="action-btn archive-icon-btn"
                                title="Archive Candidate"
                              >
                                <Archive size={14} />
                                <span>Archive</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Candidate Cards View */}
              <div className="mobile-candidate-cards">
                {candidates.map((cand) => (
                  <div
                    key={cand.id}
                    className={`mobile-candidate-card ${
                      selectedCandidate?.id === cand.id && isDrawerOpen
                        ? 'selected-row-active'
                        : ''
                    }`}
                    onClick={() => handleOpenDrawer(cand)}
                  >
                    <div className="mobile-card-top">
                      <div className="candidate-cell">
                        <strong className="candidate-name-link">{cand.name}</strong>
                        <span className="candidate-email">{cand.email}</span>
                      </div>
                      <span className={`status-badge ${cand.status}`}>
                        {cand.status}
                      </span>
                    </div>

                    <div className="mobile-card-meta">
                      <div className="meta-item">
                        <span className="meta-label">Role:</span>
                        <span className="meta-val">{cand.role_applied}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Avg Score:</span>
                        <strong className="candidate-score-pill">
                          {cand.average_score !== null && cand.average_score !== undefined
                            ? `★ ${cand.average_score}`
                            : '--'}
                        </strong>
                      </div>
                    </div>

                    {cand.skills && (
                      <div className="skill-badges">
                        {cand.skills
                          .split(',')
                          .slice(0, 4)
                          .map((s, idx) => (
                            <span key={idx} className="mini-skill-badge">
                              {s.trim()}
                            </span>
                          ))}
                      </div>
                    )}

                    <div className="mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenDrawer(cand)}
                        className="action-btn peek-btn"
                      >
                        <Eye size={14} />
                        <span>Quick Peek</span>
                      </button>

                      <button
                        onClick={() => navigate(`/candidate/${cand.id}`)}
                        className="action-btn view-btn"
                      >
                        <ExternalLink size={14} />
                        <span>Full Profile</span>
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => setArchiveCandidateTarget(cand)}
                          className="action-btn archive-icon-btn"
                        >
                          <Archive size={14} />
                          <span>Archive</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
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
