import React, { useState, useEffect, useCallback } from 'react';
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

  const fetchLeaveDetails = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/leaves/public/${leaveId}`);
      setLeave(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired link');
    } finally {
      setLoading(false);
    }
  }, [leaveId]);

  useEffect(() => {
    fetchLeaveDetails();
  }, [fetchLeaveDetails]);

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
      <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg-base)', display: 'flex', alignItems: 'center' }}>
        <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <CircularProgress />
        </Container>
      </Box>
    );
  }

  if (result) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg-base)', py: 8 }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: 4, textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
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
      </Box>
    );
  }

  if (error || !leave) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg-base)', py: 8 }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: 4, textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
          <CancelIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
          <Typography variant="h6" color="error" gutterBottom>
            {error || 'Leave request not found'}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            This link may have expired or is invalid.
          </Typography>
        </Paper>
      </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg-base)', py: 8 }}>
    <Container maxWidth="sm">
      <Paper sx={{ p: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
        <Typography variant="h4" gutterBottom align="center" color="primary">
          Leave Approval Request
        </Typography>

        <Box sx={{ my: 3, p: 2, bgcolor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
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
    </Box>
  );
};

export default ApproveLeave;
