import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
  Paper,
  Button
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PendingExpensesTable from '../components/HRDashboard/PendingExpensesTable';
import AllExpensesTable from '../components/HRDashboard/AllExpensesTable';
import FlaggedExpensesTable from '../components/HRDashboard/FlaggedExpensesTable';
import AutoApprovedExpensesTable from '../components/HRDashboard/AutoApprovedExpensesTable';

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
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/hr')}
          sx={{ mr: 2 }}
        >
          Back to HR Portal
        </Button>
        <Typography variant="h4">
          Expense Management Dashboard
        </Typography>
      </Box>

      <Paper sx={{ mt: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="All Expenses" />
          <Tab label="Pending HR Approval" />
          <Tab label="Flagged (Fraud Detection)" />
          <Tab label="Auto-Approved" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {activeTab === 0 && (
            <AllExpensesTable
              refreshTrigger={refreshTrigger}
              onActionComplete={handleActionComplete}
            />
          )}
          {activeTab === 1 && (
            <PendingExpensesTable
              refreshTrigger={refreshTrigger}
              onActionComplete={handleActionComplete}
            />
          )}
          {activeTab === 2 && (
            <FlaggedExpensesTable
              refreshTrigger={refreshTrigger}
              onActionComplete={handleActionComplete}
            />
          )}
          {activeTab === 3 && (
            <AutoApprovedExpensesTable
              refreshTrigger={refreshTrigger}
            />
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default HRExpenseDashboard;
