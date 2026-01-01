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
import { CheckCircle, Cancel, Pending, Visibility } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { hrAPI } from '../services/api';

function HRDashboard() {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    setLoading(true);
    try {
      const response = await hrAPI.getPending();
      setPending(response.data.data);
    } catch (error) {
      toast.error('Failed to load pending registrations');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      documents_submitted: 'info',
      verification_pending: 'warning',
      verified: 'success',
      rejected: 'error'
    };
    return colors[status] || 'default';
  };

  const getVerificationIcon = (status) => {
    if (status === 'passed' || status === 'approved') {
      return <CheckCircle fontSize="small" color="success" />;
    }
    if (status === 'failed' || status === 'rejected') {
      return <Cancel fontSize="small" color="error" />;
    }
    return <Pending fontSize="small" color="warning" />;
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 8, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          HR Verification Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" paragraph>
          Review and approve pending employee registrations
        </Typography>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary">
                  {pending.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pending Registrations
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="success.main">
                  {pending.filter(p => p.aiVerification.status === 'passed').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  AI Verified
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="warning.main">
                  {pending.filter(p => p.aiVerification.status === 'pending').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Awaiting AI Verification
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Pending Table */}
        {pending.length === 0 ? (
          <Alert severity="info">
            No pending registrations at this time.
          </Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Email</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Department</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Position</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Status</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">AI</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">HR</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Submitted</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pending.map((employee) => (
                  <TableRow key={employee.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {employee.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {employee.workEmail}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {employee.personalEmail}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {employee.department || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {employee.position || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={employee.onboardingStatus.replace(/_/g, ' ').toUpperCase()}
                        color={getStatusColor(employee.onboardingStatus)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {getVerificationIcon(employee.aiVerification.status)}
                        <Typography variant="caption" sx={{ ml: 0.5 }}>
                          {employee.aiVerification.score > 0 && `${employee.aiVerification.score}%`}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      {getVerificationIcon(employee.hrVerification.status)}
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="caption">
                        {new Date(employee.submittedDate).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => navigate(`/hr/verify/${employee.id}`)} // Should be emp.id
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Container>
  );
}

export default HRDashboard;
