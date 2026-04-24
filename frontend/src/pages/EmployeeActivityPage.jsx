import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import AppShell from '../components/layout/AppShell';
import { auditAPI } from '../services/api';
import { Button, Card, LoadingSpinner, StatusChip } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 10;

function formatTitle(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getRelativeTime(value) {
  if (!value) return '—';

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffHours < 48) return 'Yesterday';

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} days ago`;

  return format(date, 'd MMM yyyy');
}

function moduleDotColor(module) {
  if (module === 'expense') return 'var(--status-info)';
  if (module === 'leave') return 'var(--status-success)';
  if (module === 'onboarding') return 'var(--status-warning)';
  return 'var(--status-neutral)';
}

function actionMeta(action) {
  const normalized = String(action || '').toLowerCase();

  switch (normalized) {
    case 'submitted':
      return { status: 'initiated', label: 'Submitted' };
    case 'fraud_clean':
      return { status: 'approved', label: 'Clean' };
    case 'auto_approved':
      return { status: 'auto_approved', label: 'Approved' };
    case 'manager_approved':
    case 'hr_approved':
      return { status: 'approved', label: 'Approved' };
    case 'manager_rejected':
    case 'hr_rejected':
      return { status: 'rejected', label: 'Rejected' };
    case 'fraud_overridden_by_hr':
      return { status: 'under_review', label: 'Reviewed' };
    case 'documents_uploaded':
      return { status: 'in_progress', label: 'Uploaded' };
    case 'cnic_verified':
      return { status: 'approved', label: 'Verified' };
    case 'cnic_failed':
      return { status: 'rejected', label: 'Failed' };
    case 'record_created_in_odoo':
      return { status: 'activated', label: 'Created' };
    case 'onboarding_complete':
      return { status: 'activated', label: 'Complete' };
    case 'welcome_email_sent':
      return { status: 'initiated', label: 'Email Sent' };
    default:
      return { status: 'pending', label: formatTitle(action) };
  }
}

function EmployeeActivityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const employeeId = user?.employeeId || user?.employee_id;

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const sentinelRef = useRef(null);

  const fetchLogs = async (pageOffset = 0, replace = false) => {
    if (replace) {
      setLoading(true);
      setError('');
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await auditAPI.getEmployeeLogs(employeeId, {
        limit: PAGE_SIZE,
        offset: pageOffset
      });

      const payload = response.data || {};
      const nextLogs = Array.isArray(payload.logs) ? payload.logs : [];
      const totalCount = Number(payload.total || 0);
      const mergedLogs = replace ? nextLogs : [...logs, ...nextLogs];

      setLogs(mergedLogs);
      setTotal(totalCount);
      setOffset(pageOffset + nextLogs.length);
    } catch (requestError) {
      console.error('Failed to load employee activity:', requestError);
      setError(requestError.response?.data?.message || 'Failed to load activity timeline');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    }

    setLogs([]);
    setTotal(0);
    setOffset(0);
    fetchLogs(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  useEffect(() => {
    if (!sentinelRef.current || !employeeId) {
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting && !loading && !loadingMore && logs.length < total) {
        fetchLogs(offset, false);
      }
    }, { rootMargin: '200px' });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [employeeId, loading, loadingMore, logs.length, offset, total]); // eslint-disable-line react-hooks/exhaustive-deps

  const feedItems = useMemo(() => logs.map((log) => ({
    ...log,
    actionMeta: actionMeta(log.action),
    timeLabel: getRelativeTime(log.createdAt)
  })), [logs]);

  if (loading && logs.length === 0) {
    return (
      <AppShell pageTitle="Activity Timeline">
        <Card>
          <LoadingSpinner />
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Activity Timeline">
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700 }}>
                Activity Timeline
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
                A live feed of your recent requests, verifications, and approvals.
              </div>
            </div>
            <Button variant="ghost" onClick={() => navigate('/employee/dashboard')}>
              Back to Home
            </Button>
          </div>

          {error && (
            <div style={{ color: 'var(--status-danger)', marginBottom: 'var(--space-4)' }}>
              {error}
            </div>
          )}

          {feedItems.length === 0 && !loading ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', padding: 'var(--space-4) 0' }}>
              No activity found yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              {feedItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                    gap: 'var(--space-4)',
                    alignItems: 'center',
                    padding: 'var(--space-4)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--bg-elevated)'
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: moduleDotColor(item.module),
                      boxShadow: '0 0 0 4px rgba(255,255,255,0.02)'
                    }}
                  />

                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-1)' }}>
                      {formatTitle(item.module)}
                    </div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>
                      {item.humanMessage || formatTitle(item.action)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-2)' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
                      {item.timeLabel}
                    </div>
                    <StatusChip
                      status={item.actionMeta.status}
                      label={item.actionMeta.label}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div ref={sentinelRef} style={{ height: '1px' }} />

          {loadingMore && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-4)' }}>
              <LoadingSpinner center={false} />
            </div>
          )}

          {total > logs.length && !loadingMore && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-4)' }}>
              <Button variant="secondary" onClick={() => fetchLogs(offset, false)}>
                Load More
              </Button>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

export default EmployeeActivityPage;
