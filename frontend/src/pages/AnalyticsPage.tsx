import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { fetchAnalytics } from '../api/analytics';
import type { AnalyticsResponse } from '../types/analytics';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';
import { type ToastData } from '../utils/toast';

// Modular Analytics Components
import { AnalyticsHeader } from '../components/analytics/AnalyticsHeader';
import { AnalyticsKpiGrid } from '../components/analytics/AnalyticsKpiGrid';
import { AnalyticsFunnel } from '../components/analytics/AnalyticsFunnel';
import { AnalyticsCategoryBenchmarks } from '../components/analytics/AnalyticsCategoryBenchmarks';
import { AnalyticsScoreDistribution } from '../components/analytics/AnalyticsScoreDistribution';
import { AnalyticsRolesDemand } from '../components/analytics/AnalyticsRolesDemand';
import { AnalyticsSkillsCloud } from '../components/analytics/AnalyticsSkillsCloud';
import { AnalyticsLeaderboard } from '../components/analytics/AnalyticsLeaderboard';
import { AnalyticsReviewerActivity } from '../components/analytics/AnalyticsReviewerActivity';

import '../styles/AnalyticsPage.css';

export const AnalyticsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const loadData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await fetchAnalytics();
      setAnalytics(res);

      if (isManualRefresh) {
        setToast({
          title: 'Refreshed',
          message: 'Analytics metrics updated successfully',
          type: 'success',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load analytics';
      setToast({ title: 'Error', message: msg, type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      navigate('/login');
    } catch {
      setToast({
        title: 'Logout Failed',
        message: 'Could not complete logout session',
        type: 'error',
      });
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  return (
    <div className="analytics-container">
      {/* 1. Header & Navigation */}
      <AnalyticsHeader
        user={user}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => loadData(true)}
        onRequestLogout={() => setShowLogoutModal(true)}
      />

      {/* 2. Main Content */}
      {loading ? (
        <div className="analytics-loading-box">
          <div className="loading-spinner" style={{ width: 28, height: 28, border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%' }}></div>
          <div>Loading analytics intelligence...</div>
        </div>
      ) : !analytics ? (
        <div className="analytics-loading-box">
          <div>No analytics data available.</div>
        </div>
      ) : (
        <>
          {/* KPI Summary Cards */}
          <AnalyticsKpiGrid kpis={analytics.kpis} />

          {/* Hiring Funnel Flow */}
          <AnalyticsFunnel funnel={analytics.funnel} />

          {/* Evaluation Benchmarks & Score Distribution */}
          <div className="analytics-two-col">
            <AnalyticsCategoryBenchmarks categories={analytics.categories} />
            <AnalyticsScoreDistribution scoreDistribution={analytics.score_distribution} />
          </div>

          {/* Roles & Skills Breakdown */}
          <div className="analytics-two-col">
            <AnalyticsRolesDemand roles={analytics.roles} />
            <AnalyticsSkillsCloud topSkills={analytics.top_skills} />
          </div>

          {/* Leaderboard & Reviewer Activity */}
          <div className="analytics-two-col">
            <AnalyticsLeaderboard topCandidates={analytics.top_candidates} />
            <AnalyticsReviewerActivity
              isAdmin={isAdmin}
              reviewerActivity={analytics.reviewer_activity}
              myStats={analytics.my_stats}
            />
          </div>
        </>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <ConfirmModal
          title="Confirm Logout"
          message="Are you sure you want to log out? Your session token will be revoked."
          confirmLabel="Yes, Logout"
          cancelLabel="Stay Logged In"
          loading={isLoggingOut}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}

      {/* Toast Notifications */}
      {toast && (
        <Toast
          title={toast.title}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
