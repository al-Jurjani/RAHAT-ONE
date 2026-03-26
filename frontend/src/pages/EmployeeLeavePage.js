/**
 * EmployeeLeavePage Component
 * Path: frontend/src/pages/EmployeeLeavePage.jsx
 *
 * Main page for employee leave management
 */

import React, { useState } from 'react';
import { Container, Grid, Typography, Box } from '@mui/material';
import LeaveBalanceCard from '../components/leave/LeaveBalanceCard';
import LeaveRequestForm from '../components/leave/LeaveRequestForm';
import LeaveHistoryTable from '../components/leave/LeaveHistoryTable';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';



const EmployeeLeavePage = () => {
  const { user, loading } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();


  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (!user) {
    return null; // ProtectedRoute will redirect
  }

  const handleLeaveSubmitted = () => {
    setRefreshTrigger(prev => prev + 1);
  };


  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
    {/* Back Button */}
    <Button
        variant="text"
        onClick={() => navigate('/employee/dashboard')}
        sx={{ mb: 2 }}
    >
        ← Back to Dashboard
    </Button>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Leave Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View your leave balance, submit new requests, and track request status
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column: Balance + Form */}
        <Grid item xs={12} md={4}>
          <Grid container spacing={3}>
            {/* Leave Balance Card */}
            <Grid item xs={12}>
              <LeaveBalanceCard refreshTrigger={refreshTrigger} />
            </Grid>

            {/* Leave Request Form */}
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
    </Container>
  );


};

export default EmployeeLeavePage;
