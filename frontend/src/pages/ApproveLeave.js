import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Container,
  Paper,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Box,
  Chip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

const API_BASE_URL = 'http://localhost:5000';

const ApproveLeave = () => {
  const { leaveId } = useParams();

  const [leave, setLeave] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchLeaveDetails();
  }, []);

  const fetchLeaveDetails = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/leaves/public/${leaveId}`);
      setLeave(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired link');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (decision) => {
    try {
      setActionLoading(true);
      await axios.post(
        `${API_BASE_URL}/api/leaves/${leaveId}/manager-decision`,
        {
          decision: decision,
          managerName: leave.managerName,
          managerEmail: leave.managerEmail,
          remarks: remarks || `${decision === 'approved' ? 'Approved' : 'Rejected'} by manager`
        }
      );

      setResult({
        success: true,
        decision: decision,
        message: `Leave request ${decision} successfully!`
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process decision');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (result) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          {result.decision === 'approved' ? (
            <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          ) : (
            <CancelIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
          )}
          <Typography variant="h5" color={result.decision === 'approved' ? 'success.main' : 'error.main'} gutterBottom>
            {result.message}
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
            The employee and HR have been notified of your decision.
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (error || !leave) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CancelIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
          <Typography variant="h6" color="error" gutterBottom>
            {error || 'Leave request not found'}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            This link may have expired or is invalid.
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom align="center" color="primary">
          Leave Approval Request
        </Typography>

        <Box sx={{ my: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="h6" gutterBottom>
            {leave.employeeName}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip label={leave.leaveType} color="primary" size="small" />
            <Chip label={`${leave.numberOfDays} days`} color="secondary" size="small" />
          </Box>

          <Typography variant="body2" color="textSecondary" gutterBottom>
            <strong>Dates:</strong> {leave.dateFrom} to {leave.dateTo}
          </Typography>

          <Typography variant="body2" color="textSecondary" gutterBottom>
            <strong>Reason:</strong> {leave.reason || 'No reason provided'}
          </Typography>
        </Box>

        <TextField
          fullWidth
          label="Remarks (Optional)"
          placeholder="Add any comments or conditions..."
          multiline
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          sx={{ mb: 3 }}
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            fullWidth
            variant="contained"
            color="success"
            size="large"
            onClick={() => handleDecision('approved')}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            Approve
          </Button>

          <Button
            fullWidth
            variant="contained"
            color="error"
            size="large"
            onClick={() => handleDecision('rejected')}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <CancelIcon />}
          >
            Reject
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default ApproveLeave;
