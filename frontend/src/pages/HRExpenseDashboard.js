import React, { useState } from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { Button } from '../components/ui';
import PendingExpensesTable from '../components/HRDashboard/PendingExpensesTable';
import AllExpensesTable from '../components/HRDashboard/AllExpensesTable';
import FlaggedExpensesTable from '../components/HRDashboard/FlaggedExpensesTable';
import AutoApprovedExpensesTable from '../components/HRDashboard/AutoApprovedExpensesTable';
import AutoRejectedExpensesTable from '../components/HRDashboard/AutoRejectedExpensesTable';

const HRExpenseDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleActionComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <AppShell pageTitle="Expense Management">
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Button variant="ghost" onClick={() => navigate('/hr')} size="sm">
          <ArrowBack fontSize="small" style={{ marginRight: 'var(--space-1)' }} />
          Back to HR Portal
        </Button>
      </div>

      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="All Expenses" />
          <Tab label="Pending HR Approval" />
          <Tab label="Flagged (Fraud Detection)" />
          <Tab label="Auto-Approved" />
          <Tab label="Auto-Rejected" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {activeTab === 0 && <AllExpensesTable refreshTrigger={refreshTrigger} onActionComplete={handleActionComplete} />}
          {activeTab === 1 && <PendingExpensesTable refreshTrigger={refreshTrigger} onActionComplete={handleActionComplete} />}
          {activeTab === 2 && <FlaggedExpensesTable refreshTrigger={refreshTrigger} onActionComplete={handleActionComplete} />}
          {activeTab === 3 && <AutoApprovedExpensesTable refreshTrigger={refreshTrigger} />}
          {activeTab === 4 && <AutoRejectedExpensesTable refreshTrigger={refreshTrigger} />}
        </Box>
      </div>
    </AppShell>
  );
};

export default HRExpenseDashboard;
