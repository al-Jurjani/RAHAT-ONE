import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Cancel, Pending, Visibility, ArrowBack } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { hrAPI } from '../services/api';
import { Tabs, Tab} from '@mui/material';

function HRDashboard() {
  const [loading, setLoading] = useState(true);
  const [pendingList, setPendingList] = useState([]);
  const [approvedList, setApprovedList] = useState([]);
  const [rejectedList, setRejectedList] = useState([]);
  const [currentTab, setCurrentTab] = useState(0); // 0=Pending, 1=Approved, 2=Rejected
  const navigate = useNavigate();

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load all three lists
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        hrAPI.getPending(),
        hrAPI.getApproved(), // We'll create this
        hrAPI.getRejected()  // We'll create this
      ]);

      setPendingList(pendingRes.data.data || []);
      setApprovedList(approvedRes.data.data || []);
      setRejectedList(rejectedRes.data.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      pending: { label: 'PENDING', color: 'warning' },
      approved: { label: 'APPROVED', color: 'success' },
      rejected: { label: 'REJECTED', color: 'error' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  // Get current list based on tab
  const getCurrentList = () => {
    switch(currentTab) {
      case 0: return pendingList;
      case 1: return approvedList;
      case 2: return rejectedList;
      default: return pendingList;
    }
  };

  const currentList = getCurrentList();

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 8, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 8, mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/hr')}
            sx={{ mr: 2 }}
          >
            Back to HR Portal
          </Button>
          <Typography variant="h4" component="h1">
            HR Verification Dashboard
          </Typography>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Pending Verification
                </Typography>
                <Typography variant="h3" color="warning.main">
                  {pendingList.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Recently Approved
                </Typography>
                <Typography variant="h3" color="success.main">
                  {approvedList.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Recently Rejected
                </Typography>
                <Typography variant="h3" color="error.main">
                  {rejectedList.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper sx={{ mb: 2 }}>
          <Tabs value={currentTab} onChange={handleTabChange}>
            <Tab label={`Pending (${pendingList.length})`} />
            <Tab label={`Approved (${approvedList.length})`} />
            <Tab label={`Rejected (${rejectedList.length})`} />
          </Tabs>
        </Paper>

        {/* Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead sx={{ bgcolor: 'primary.main' }}>
              <TableRow>
                <TableCell sx={{ color: 'white' }}>Name</TableCell>
                <TableCell sx={{ color: 'white' }}>Email (Work)</TableCell>
                <TableCell sx={{ color: 'white' }}>Email (Personal)</TableCell>
                <TableCell sx={{ color: 'white' }}>Department</TableCell>
                <TableCell sx={{ color: 'white' }}>Position</TableCell>
                <TableCell sx={{ color: 'white' }}>Status</TableCell>
                <TableCell sx={{ color: 'white' }}>AI Verification</TableCell>
                <TableCell sx={{ color: 'white' }}>HR Status</TableCell>
                <TableCell sx={{ color: 'white' }}>Submitted</TableCell>
                <TableCell sx={{ color: 'white' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography variant="body1" color="text.secondary" sx={{ py: 4 }}>
                      {currentTab === 0 && 'No pending verifications'}
                      {currentTab === 1 && 'No approved candidates yet'}
                      {currentTab === 2 && 'No rejected candidates yet'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                currentList.map((emp) => (
                  <TableRow key={emp.id} hover>
                    <TableCell>{emp.name}</TableCell>
                    <TableCell>{emp.workEmail || 'N/A'}</TableCell>
                    <TableCell>{emp.personalEmail}</TableCell>
                    <TableCell>{emp.department || 'N/A'}</TableCell>
                    <TableCell>{emp.position || 'N/A'}</TableCell>
                    <TableCell>{getStatusChip(emp.onboardingStatus)}</TableCell>
                    <TableCell>
                      {emp.aiVerificationStatus === 'passed' && (
                        <Chip icon={<CheckCircle />} label="PASSED" color="success" size="small" />
                      )}
                      {emp.aiVerificationStatus === 'failed' && (
                        <Chip icon={<Cancel />} label="FAILED" color="error" size="small" />
                      )}
                      {emp.aiVerificationStatus === 'pending' && (
                        <Chip label="PENDING" color="warning" size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusChip(emp.hrVerificationStatus)}
                    </TableCell>
                    <TableCell>
                      {emp.submittedAt ? new Date(emp.submittedAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => navigate(`/hr/verification/${emp.id}`)}
                      >
                        {currentTab === 0 ? 'Review' : 'View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Container>
  );
}

export default HRDashboard;
