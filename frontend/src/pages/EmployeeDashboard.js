import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddCardIcon from '@mui/icons-material/AddCard';
import EventNoteIcon from '@mui/icons-material/EventNote';
import BadgeIcon from '@mui/icons-material/Badge';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import AppShell from '../components/layout/AppShell';
import { Card, StatCard, StatusChip, LoadingSpinner, Button } from '../components/ui';
import { employeeAPI, auditAPI } from '../services/api';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'morning';
  }
  if (hour < 17) {
    return 'afternoon';
  }
  return 'evening';
}

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

function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const employeeId = user?.employeeId;

  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.('(max-width: 768px)').matches ?? false);

  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 768px)');
    if (!mq) return undefined;
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener?.('change', handler) ?? mq.addListener?.(handler);
    return () => mq.removeEventListener?.('change', handler) ?? mq.removeListener?.(handler);
  }, []);
  const [stats, setStats] = useState({
    leaveBalance: 0,
    pendingExpenseClaims: 0,
    leavesTakenThisYear: 0
  });
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const loadHomeData = async () => {
      if (!employeeId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [leaveSummaryRes, expenseSummaryRes, activityRes] = await Promise.allSettled([
          employeeAPI.getLeaveSummary(employeeId),
          employeeAPI.getExpenseSummary(employeeId),
          auditAPI.getEmployeeLogs(employeeId, { limit: 10, offset: 0 })
        ]);

        const leaveSummary = leaveSummaryRes.status === 'fulfilled' ? (leaveSummaryRes.value.data?.data || {}) : {};
        const expenseSummary = expenseSummaryRes.status === 'fulfilled' ? (expenseSummaryRes.value.data?.data || {}) : {};
        const activityPayload = activityRes.status === 'fulfilled' ? (activityRes.value.data || {}) : {};
        const recentActivity = Array.isArray(activityPayload.logs) ? activityPayload.logs : [];

        setStats({
          leaveBalance: leaveSummary.leaveBalance || 0,
          pendingExpenseClaims: expenseSummary.pendingExpenseClaims || 0,
          leavesTakenThisYear: leaveSummary.leavesTakenThisYear || 0
        });

        setActivities(recentActivity.map((item) => ({
          ...item,
          actionMeta: actionMeta(item.action),
          timeLabel: getRelativeTime(item.createdAt)
        })));

        if (leaveSummaryRes.status === 'rejected' || expenseSummaryRes.status === 'rejected' || activityRes.status === 'rejected') {
          console.warn('Some employee home sections failed to load; showing partial data.');
        }
      } catch (error) {
        console.error('Failed to load employee home data:', error);
        toast.error('Unable to load employee home data');
      } finally {
        setLoading(false);
      }
    };

    loadHomeData();
  }, [employeeId]);

  const firstName = useMemo(() => user?.name?.split(' ')[0] || 'there', [user?.name]);

  if (loading) {
    return (
      <AppShell pageTitle="Employee Home">
        <LoadingSpinner />
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Employee Home">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            lineHeight: 1.2,
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0
          }}
        >
          Good {getGreeting()}, {firstName}
        </h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)'
        }}
      >
        <StatCard icon={<EventAvailableIcon />} value={stats.leaveBalance} label="Leave Balance" />
        <StatCard icon={<ReceiptLongIcon />} value={stats.pendingExpenseClaims} label="Pending Expense Claims" />
        <StatCard icon={<AccessTimeIcon />} value={stats.leavesTakenThisYear} label="Leaves Taken This Year" />
      </div>

      {!isMobile && <Card
        header="Recent Activity"
        headerRight={(
          <Button variant="ghost" onClick={() => navigate('/employee/activity')}>
            View All Activity
          </Button>
        )}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        {activities.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            No recent activity found.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {activities.map((activity) => (
              <div
                key={activity.id}
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
                    background: moduleDotColor(activity.module)
                  }}
                />

                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-1)' }}>
                    {formatTitle(activity.module)}
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>
                    {activity.humanMessage || formatTitle(activity.action)}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-2)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
                    {activity.timeLabel}
                  </div>
                  <StatusChip status={activity.actionMeta.status} label={activity.actionMeta.label} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>}

      {!isMobile && (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)'
        }}
      >
        <Card hoverable style={{ cursor: 'pointer' }} onClick={() => navigate('/expenses/submit')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <AddCardIcon style={{ color: 'var(--accent-primary)' }} />
            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Submit Expense</div>
          </div>
        </Card>

        <Card hoverable style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/leaves')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <EventNoteIcon style={{ color: 'var(--status-info)' }} />
            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Request Leave</div>
          </div>
        </Card>

        <Card hoverable style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/profile')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <BadgeIcon style={{ color: 'var(--status-success)' }} />
            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>View Profile</div>
          </div>
        </Card>
      </div>
      )}
    </AppShell>
  );
}

export default EmployeeDashboard;
