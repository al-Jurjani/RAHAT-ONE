import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddCardIcon from '@mui/icons-material/AddCard';
import EventNoteIcon from '@mui/icons-material/EventNote';
import BadgeIcon from '@mui/icons-material/Badge';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import AppShell from '../components/layout/AppShell';
import { Card, StatCard, StatusChip, LoadingSpinner } from '../components/ui';
import { employeeAPI, leaveAPI, expenseAPI } from '../services/api';

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

function parseDate(value) {
  return value ? new Date(value) : new Date(0);
}

function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const employeeId = user?.employeeId;

  const [loading, setLoading] = useState(true);
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
        const [leaveSummaryRes, expenseSummaryRes, leavesRes, expensesRes] = await Promise.all([
          employeeAPI.getLeaveSummary(employeeId),
          employeeAPI.getExpenseSummary(employeeId),
          leaveAPI.getMyLeaves(),
          expenseAPI.list({})
        ]);

        const leaveSummary = leaveSummaryRes.data?.data || {};
        const expenseSummary = expenseSummaryRes.data?.data || {};

        const recentLeaves = (Array.isArray(leavesRes.data) ? leavesRes.data : [])
          .sort((a, b) => parseDate(b.create_date) - parseDate(a.create_date))
          .slice(0, 3)
          .map((leave) => ({
            id: `leave-${leave.id}`,
            type: 'Leave',
            title: `${leave.holiday_status_id?.[1] || 'Leave'} request`,
            subtitle: `${leave.request_date_from || '-'} to ${leave.request_date_to || '-'}`,
            status: leave.state || 'pending',
            date: leave.create_date || leave.request_date_from
          }));

        const expenseItems = expensesRes.data?.data?.expenses || [];
        const recentExpenses = expenseItems
          .sort((a, b) => parseDate(b.create_date) - parseDate(a.create_date))
          .slice(0, 2)
          .map((expense) => ({
            id: `expense-${expense.id}`,
            type: 'Expense',
            title: `${expense.expense_category || 'Expense'} claim`,
            subtitle: `PKR ${expense.total_amount || 0}`,
            status: expense.workflow_status || 'pending',
            date: expense.create_date || expense.date
          }));

        const mergedActivities = [...recentLeaves, ...recentExpenses]
          .sort((a, b) => parseDate(b.date) - parseDate(a.date))
          .slice(0, 5);

        setStats({
          leaveBalance: leaveSummary.leaveBalance || 0,
          pendingExpenseClaims: expenseSummary.pendingExpenseClaims || 0,
          leavesTakenThisYear: leaveSummary.leavesTakenThisYear || 0
        });

        setActivities(mergedActivities);
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

      <Card header="Recent Activity" style={{ marginBottom: 'var(--space-6)' }}>
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
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--bg-elevated)'
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    [{activity.type}] {activity.title}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
                    {activity.subtitle}
                  </div>
                </div>
                <StatusChip status={activity.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

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
    </AppShell>
  );
}

export default EmployeeDashboard;
