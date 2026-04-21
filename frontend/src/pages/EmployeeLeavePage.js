import React, { useState } from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import LeaveBalanceCard from '../components/leave/LeaveBalanceCard';
import LeaveRequestForm from '../components/leave/LeaveRequestForm';
import LeaveHistoryTable from '../components/leave/LeaveHistoryTable';
import { useAuth } from '../contexts/AuthContext';
import AppShell from '../components/layout/AppShell';
import { LoadingSpinner } from '../components/ui';

const EmployeeLeavePage = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (loading) {
    return (
      <AppShell pageTitle="My Leaves">
        <LoadingSpinner />
      </AppShell>
    );
  }

  if (!user) return null;

  const handleLeaveSubmitted = () => {
    setRefreshTrigger((prev) => prev + 1);
    // Switch to Leave History tab so the employee sees their new request
    setActiveTab(1);
  };

  return (
    <AppShell pageTitle="My Leaves">
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        marginBottom: 'var(--space-6)',
      }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Overview" />
          <Tab label="Leave History" />
        </Tabs>
      </div>

      {activeTab === 0 && (
        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
          {/* Leave Balances */}
          <Box sx={{ flex: '0 0 320px' }}>
            <LeaveBalanceCard refreshTrigger={refreshTrigger} />
          </Box>

          {/* Request Leave form */}
          <Box sx={{ flex: 1 }}>
            <LeaveRequestForm onSubmitSuccess={handleLeaveSubmitted} />
          </Box>
        </Box>
      )}

      {activeTab === 1 && (
        <LeaveHistoryTable refreshTrigger={refreshTrigger} />
      )}
    </AppShell>
  );
};

export default EmployeeLeavePage;
