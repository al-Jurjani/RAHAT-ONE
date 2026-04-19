import React, { useState } from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { Button } from '../components/ui';
import { ArrowBack } from '@mui/icons-material';
import PendingLeavesTable from '../components/HRDashboard/PendingLeavesTable';
import AllLeavesTable from '../components/HRDashboard/AllLeavesTable';
import AllocationManagement from '../components/HRDashboard/AllocationManagement';
import BlackoutDatesManagement from '../components/HRDashboard/BlackoutDatesManagement';

const HRLeaveDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const navigate = useNavigate();

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <AppShell pageTitle="Leave Management">
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
          <Tab label="Pending Approvals" />
          <Tab label="All Leaves" />
          <Tab label="Allocate Leaves" />
          <Tab label="Blackout Dates" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {activeTab === 0 && <PendingLeavesTable onActionComplete={() => {}} />}
          {activeTab === 1 && <AllLeavesTable />}
          {activeTab === 2 && <AllocationManagement />}
          {activeTab === 3 && <BlackoutDatesManagement />}
        </Box>
      </div>
    </AppShell>
  );
};

export default HRLeaveDashboard;
