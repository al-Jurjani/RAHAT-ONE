import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EventNoteIcon from '@mui/icons-material/EventNote';
import ReceiptIcon from '@mui/icons-material/Receipt';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { toast } from 'react-toastify';
import AppShell from '../components/layout/AppShell';
import { Button, Card, LoadingSpinner, StatCard, StatusChip } from '../components/ui';
import { hrAPI, hrDashboardAPI } from '../services/api';
import PendingLeavesTable from '../components/HRDashboard/PendingLeavesTable';
import AllLeavesTable from '../components/HRDashboard/AllLeavesTable';
import AllocationManagement from '../components/HRDashboard/AllocationManagement';
import BlackoutDatesManagement from '../components/HRDashboard/BlackoutDatesManagement';
import PendingExpensesTable from '../components/HRDashboard/PendingExpensesTable';
import AllExpensesTable from '../components/HRDashboard/AllExpensesTable';
import FlaggedExpensesTable from '../components/HRDashboard/FlaggedExpensesTable';
import AutoApprovedExpensesTable from '../components/HRDashboard/AutoApprovedExpensesTable';
import AutoRejectedExpensesTable from '../components/HRDashboard/AutoRejectedExpensesTable';

const MODULES = {
  OVERVIEW: 'overview',
  ONBOARDING: 'onboarding',
  LEAVE: 'leave',
  EXPENSE: 'expense'
};

function HRMainPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState(MODULES.OVERVIEW);
  const [summary, setSummary] = useState({ counts: {}, needsAttention: [], recentActivity: [] });
  const [onboardingItems, setOnboardingItems] = useState([]);
  const [leaveTab, setLeaveTab] = useState('pending');
  const [expenseTab, setExpenseTab] = useState('all');
  const [expenseRefresh, setExpenseRefresh] = useState(0);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [summaryRes, onboardingRes] = await Promise.all([
          hrDashboardAPI.getSummary(),
          hrAPI.getPending()
        ]);

        setSummary(summaryRes.data?.data || { counts: {}, needsAttention: [], recentActivity: [] });
        setOnboardingItems(onboardingRes.data?.data || []);
      } catch (error) {
        console.error('Failed to load HR dashboard summary:', error);
        toast.error('Failed to load HR dashboard summary');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const moduleCards = useMemo(() => ([
    {
      key: MODULES.OVERVIEW,
      label: 'Overview',
      icon: <DashboardIcon fontSize="small" />,
      badge: summary.counts?.totalPendingApprovals || 0
    },
    {
      key: MODULES.ONBOARDING,
      label: 'Onboarding',
      icon: <PersonAddIcon fontSize="small" />,
      badge: summary.counts?.onboardingPending || 0
    },
    {
      key: MODULES.LEAVE,
      label: 'Leave Management',
      icon: <EventNoteIcon fontSize="small" />,
      badge: summary.counts?.leavePending || 0
    },
    {
      key: MODULES.EXPENSE,
      label: 'Expense Management',
      icon: <ReceiptIcon fontSize="small" />,
      badge: summary.counts?.expensePending || 0
    }
  ]), [summary.counts]);

  if (loading) {
    return (
      <AppShell pageTitle="HR Home">
        <LoadingSpinner />
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="HR Home">
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--space-5)', alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            {moduleCards.map((module) => {
              const selected = activeModule === module.key;
              return (
                <button
                  key={module.key}
                  onClick={() => setActiveModule(module.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    border: selected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    background: selected ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2) var(--space-3)',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ display: 'inline-flex', gap: 'var(--space-2)', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                    {module.icon}
                    {module.label}
                  </span>
                  <span
                    style={{
                      minWidth: 24,
                      height: 24,
                      borderRadius: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: selected ? 'var(--accent-primary)' : 'var(--bg-base)',
                      color: selected ? 'var(--bg-base)' : 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600
                    }}
                  >
                    {module.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {activeModule === MODULES.OVERVIEW && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                <StatCard value={summary.counts?.totalPendingApprovals || 0} label="Total Pending Approvals" />
                <StatCard value={summary.counts?.fraudFlagsToday || 0} label="Fraud Flags Today" />
                <StatCard value={summary.counts?.activeOnboardings || 0} label="Active Onboardings" />
                <StatCard value={summary.counts?.leavesThisWeek || 0} label="Leaves This Week" />
              </div>

              <Card header="Needs Attention">
                {summary.needsAttention?.length ? (
                  <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    {summary.needsAttention.map((item, idx) => (
                      <div
                        key={`${item.type}-${idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 'var(--space-3)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: 'var(--space-3) var(--space-4)',
                          background: 'var(--bg-elevated)'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--text-primary)', fontWeight: 600 }}>
                            <WarningAmberIcon fontSize="small" style={{ color: 'var(--status-warning)' }} />
                            {item.title}
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
                            {item.subtitle}
                          </div>
                        </div>
                        <StatusChip status={item.status || 'pending'} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No urgent items right now.</div>
                )}
              </Card>

              <Card header="Recent System Activity">
                {summary.recentActivity?.length ? (
                  <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    {summary.recentActivity.map((item, idx) => (
                      <div key={`${item.type}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                            [{item.type}] {item.title}
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>{item.subtitle}</div>
                        </div>
                        <StatusChip status={item.status || 'pending'} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No activity to show yet.</div>
                )}
              </Card>
            </>
          )}

          {activeModule === MODULES.ONBOARDING && (
            <Card header={`Onboarding Queue (${onboardingItems.length})`}>
              {onboardingItems.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No pending onboarding verifications.</div>
              ) : (
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  {onboardingItems.map((item) => (
                    <div
                      key={item.id}
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
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.name}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{item.personalEmail || item.workEmail || 'No email'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <StatusChip status={item.hrVerificationStatus || item.onboardingStatus || 'pending'} />
                        <Button size="sm" onClick={() => navigate(`/hr/verification/${item.id}`)}>Review</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeModule === MODULES.LEAVE && (
            <Card
              header="Leave Management"
              headerRight={(
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button size="sm" variant={leaveTab === 'pending' ? 'primary' : 'secondary'} onClick={() => setLeaveTab('pending')}>Pending</Button>
                  <Button size="sm" variant={leaveTab === 'all' ? 'primary' : 'secondary'} onClick={() => setLeaveTab('all')}>All</Button>
                  <Button size="sm" variant={leaveTab === 'allocate' ? 'primary' : 'secondary'} onClick={() => setLeaveTab('allocate')}>Allocate</Button>
                  <Button size="sm" variant={leaveTab === 'blackout' ? 'primary' : 'secondary'} onClick={() => setLeaveTab('blackout')}>Blackout</Button>
                </div>
              )}
            >
              {leaveTab === 'pending' && <PendingLeavesTable onActionComplete={() => {}} />}
              {leaveTab === 'all' && <AllLeavesTable />}
              {leaveTab === 'allocate' && <AllocationManagement />}
              {leaveTab === 'blackout' && <BlackoutDatesManagement />}
            </Card>
          )}

          {activeModule === MODULES.EXPENSE && (
            <Card
              header="Expense Management"
              headerRight={(
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Button size="sm" variant={expenseTab === 'all' ? 'primary' : 'secondary'} onClick={() => setExpenseTab('all')}>All</Button>
                  <Button size="sm" variant={expenseTab === 'pending' ? 'primary' : 'secondary'} onClick={() => setExpenseTab('pending')}>Pending</Button>
                  <Button size="sm" variant={expenseTab === 'flagged' ? 'primary' : 'secondary'} onClick={() => setExpenseTab('flagged')}>Flagged</Button>
                  <Button size="sm" variant={expenseTab === 'auto-approved' ? 'primary' : 'secondary'} onClick={() => setExpenseTab('auto-approved')}>Auto-Approved</Button>
                  <Button size="sm" variant={expenseTab === 'auto-rejected' ? 'primary' : 'secondary'} onClick={() => setExpenseTab('auto-rejected')}>Auto-Rejected</Button>
                </div>
              )}
            >
              {expenseTab === 'all' && <AllExpensesTable refreshTrigger={expenseRefresh} onActionComplete={() => setExpenseRefresh((n) => n + 1)} />}
              {expenseTab === 'pending' && <PendingExpensesTable refreshTrigger={expenseRefresh} onActionComplete={() => setExpenseRefresh((n) => n + 1)} />}
              {expenseTab === 'flagged' && <FlaggedExpensesTable refreshTrigger={expenseRefresh} onActionComplete={() => setExpenseRefresh((n) => n + 1)} />}
              {expenseTab === 'auto-approved' && <AutoApprovedExpensesTable refreshTrigger={expenseRefresh} />}
              {expenseTab === 'auto-rejected' && <AutoRejectedExpensesTable refreshTrigger={expenseRefresh} />}
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default HRMainPage;
