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
import PendingLeavesTable from '../components/HRDashboard/PendingLeavesTable';
import AllLeavesTable from '../components/HRDashboard/AllLeavesTable';
import AllocationManagement from '../components/HRDashboard/AllocationManagement';

const HRLeaveDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const navigate = useNavigate();

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
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
          Leave Management Dashboard
        </Typography>
      </Box>

      <Paper sx={{ mt: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Pending Approvals" />
          <Tab label="All Leaves" />
          <Tab label="Allocate Leaves" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {activeTab === 0 && (
            <PendingLeavesTable
              onActionComplete={() => {
                // Optionally refresh data or show success message
              }}
            />
          )}
          {activeTab === 1 && <AllLeavesTable />}
          {activeTab === 2 && <AllocationManagement />}
        </Box>
      </Paper>
    </Container>
  );
};

export default HRLeaveDashboard;
