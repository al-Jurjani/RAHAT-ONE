/**
 * EmployeeLeavePage Component
 * Path: frontend/src/pages/EmployeeLeavePage.jsx
 *
 * Main page for employee leave management
 */

import React, { useState } from 'react';
import { Grid } from '@mui/material';
import LeaveBalanceCard from '../components/leave/LeaveBalanceCard';
import LeaveRequestForm from '../components/leave/LeaveRequestForm';
import LeaveHistoryTable from '../components/leave/LeaveHistoryTable';
import { useAuth } from '../contexts/AuthContext';
import AppShell from '../components/layout/AppShell';
import { LoadingSpinner } from '../components/ui';

const EmployeeLeavePage = () => {
  const { user, loading } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (loading) {
    return (
      <AppShell pageTitle="Leave Management">
        <LoadingSpinner />
      </AppShell>
    );
  }

  if (!user) {
    return null; // ProtectedRoute will redirect
  }

  const handleLeaveSubmitted = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <AppShell pageTitle="Leave Management">
      <Grid container spacing={3}>
        {/* Left Column: Balance + Form */}
        <Grid item xs={12} md={4}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <LeaveBalanceCard refreshTrigger={refreshTrigger} />
            </Grid>
            <Grid item xs={12}>
              <LeaveRequestForm onSubmitSuccess={handleLeaveSubmitted} />
            </Grid>
          </Grid>
        </Grid>

        {/* Right Column: Leave History */}
        <Grid item xs={12} md={8}>
          <LeaveHistoryTable refreshTrigger={refreshTrigger} />
        </Grid>
      </Grid>
    </AppShell>
  );
};

export default EmployeeLeavePage;
