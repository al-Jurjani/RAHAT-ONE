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
import { CheckCircle, Cancel, Pending, Visibility, ArrowBack, AutoMode } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { hrAPI } from '../services/api';
import { Tabs, Tab} from '@mui/material';

function HRDashboard() {
  const [loading, setLoading] = useState(true);
  const [pendingList, setPendingList] = useState([]);
  const [approvedList, setApprovedList] = useState([]);
  const [autoApprovedList, setAutoApprovedList] = useState([]);
  const [rejectedList, setRejectedList] = useState([]);
  const [currentTab, setCurrentTab] = useState(0); // 0=Pending, 1=Auto-Approved, 2=HR Approved, 3=Rejected
  const navigate = useNavigate();

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [pendingRes, autoApprovedRes, approvedRes, rejectedRes] = await Promise.all([
        hrAPI.getPending(),
        hrAPI.getAutoApproved(),
        hrAPI.getApproved(),
        hrAPI.getRejected()
      ]);

      setPendingList(pendingRes.data.data || []);
      setAutoApprovedList(autoApprovedRes.data.data || []);
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
      rejected: { label: 'REJECTED', color: 'error' },
      activated: { label: 'ACTIVATED', color: 'success' },
      verification_pending: { label: 'VERIFICATION PENDING', color: 'warning' },
      initiated: { label: 'INITIATED', color: 'info' },
      expired: { label: 'EXPIRED', color: 'default' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  // Get current list based on tab
  const getCurrentList = () => {
    switch(currentTab) {
      case 0: return pendingList;
      case 1: return autoApprovedList;
      case 2: return approvedList;
      case 3: return rejectedList;
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
          <Grid item xs={12} md={3}>
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
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Auto-Approved
                </Typography>
                <Typography variant="h3" color="info.main">
                  {autoApprovedList.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  HR Approved
                </Typography>
                <Typography variant="h3" color="success.main">
                  {approvedList.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Rejected
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
            <Tab label={`Auto-Approved (${autoApprovedList.length})`} />
            <Tab label={`HR Approved (${approvedList.length})`} />
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
                {currentTab === 1 ? (
                  <TableCell sx={{ color: 'white' }}>CNIC Verified</TableCell>
                ) : (
                  <TableCell sx={{ color: 'white' }}>AI Verification</TableCell>
                )}
                {currentTab !== 1 && (
                  <TableCell sx={{ color: 'white' }}>HR Status</TableCell>
                )}
                <TableCell sx={{ color: 'white' }}>
                  {currentTab === 1 ? 'Auto-Approved' : 'Submitted'}
                </TableCell>
                <TableCell sx={{ color: 'white' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography variant="body1" color="text.secondary" sx={{ py: 4 }}>
                      {currentTab === 0 && 'No pending verifications'}
                      {currentTab === 1 && 'No auto-approved candidates yet'}
                      {currentTab === 2 && 'No HR-approved candidates yet'}
                      {currentTab === 3 && 'No rejected candidates yet'}
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
                    {currentTab === 1 ? (
                      <TableCell>
                        {emp.cnicVerified ? (
                          <Chip icon={<CheckCircle />} label="VERIFIED" color="success" size="small" />
                        ) : (
                          <Chip icon={<Cancel />} label="NOT VERIFIED" color="error" size="small" />
                        )}
                      </TableCell>
                    ) : (
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
                    )}
                    {currentTab !== 1 && (
                      <TableCell>
                        {getStatusChip(emp.hrVerificationStatus)}
                      </TableCell>
                    )}
                    <TableCell>
                      {emp.approvedAt
                        ? new Date(emp.approvedAt).toLocaleDateString()
                        : emp.submittedAt
                          ? new Date(emp.submittedAt).toLocaleDateString()
                          : 'N/A'}
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
