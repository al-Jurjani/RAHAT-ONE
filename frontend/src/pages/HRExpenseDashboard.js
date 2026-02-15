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
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="textSecondary">
                Fraud detection system coming soon. Check back later!
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default HRExpenseDashboard;
