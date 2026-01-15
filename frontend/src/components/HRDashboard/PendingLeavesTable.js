import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Typography
} from '@mui/material';
import axios from 'axios';

const PendingLeavesTable = ({ onActionComplete }) => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [action, setAction] = useState('');
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPendingLeaves();
  }, []);

  const fetchPendingLeaves = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const response = await axios.get(
        'http://localhost:5000/api/leaves?status=confirm',
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setLeaves(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load pending leaves');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (leave, actionType) => {
    setSelectedLeave(leave);
    setAction(actionType);
    setRemarks('');
    setDialogOpen(true);
  };

  const confirmAction = async () => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('accessToken');

      await axios.put(
        `http://localhost:5000/api/leaves/${selectedLeave.id}/status`,
        {
          action: action,
          remarks: remarks || `${action === 'approve' ? 'Approved' : 'Rejected'} by HR`
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setDialogOpen(false);
      fetchPendingLeaves();

      if (onActionComplete) {
        onActionComplete();
      }
    } catch (err) {
      setError(`Failed to ${action} leave`);
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <CircularProgress />
      </div>
    );
  }

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Employee</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Leave Type</strong></TableCell>
              <TableCell><strong>From</strong></TableCell>
              <TableCell><strong>To</strong></TableCell>
              <TableCell><strong>Days</strong></TableCell>
              <TableCell><strong>Reason</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {leaves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="textSecondary">No pending leaves</Typography>
                </TableCell>
              </TableRow>
            ) : (
              leaves.map((leave) => (
                <TableRow key={leave.id}>
                  <TableCell>{leave.employee_id[1]}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="textSecondary">
                      {leave.employee_email || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={leave.holiday_status_id[1]}
                      size="small"
                      color="primary"
                    />
                  </TableCell>
                  <TableCell>{leave.request_date_from}</TableCell>
                  <TableCell>{leave.request_date_to}</TableCell>
                  <TableCell>{leave.number_of_days}</TableCell>
                  <TableCell>{leave.name}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => handleAction(leave, 'approve')}
                      sx={{ mr: 1 }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => handleAction(leave, 'reject')}
                    >
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>
          {action === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Employee: <strong>{selectedLeave?.employee_id[1]}</strong><br />
            Dates: <strong>{selectedLeave?.request_date_from} to {selectedLeave?.request_date_to}</strong><br />
            Days: <strong>{selectedLeave?.number_of_days}</strong>
          </Typography>

          <TextField
            fullWidth
            label="Remarks (Optional)"
            multiline
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={`Enter ${action === 'approve' ? 'approval' : 'rejection'} remarks...`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={confirmAction}
            variant="contained"
            color={action === 'approve' ? 'success' : 'error'}
            disabled={actionLoading}
          >
            {actionLoading ? <CircularProgress size={20} /> : `Confirm ${action === 'approve' ? 'Approval' : 'Rejection'}`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PendingLeavesTable;
