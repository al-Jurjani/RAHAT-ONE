/**
 * LeaveHistoryTable Component
 * Path: frontend/src/components/leave/LeaveHistoryTable.jsx
 *
 * Displays employee's leave request history
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Box,
  Tabs,
  Tab
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  HourglassEmpty as HourglassEmptyIcon
} from '@mui/icons-material';
import axios from 'axios';

const LeaveHistoryTable = ({ refreshTrigger = 0 }) => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'confirm', 'validate', 'refuse'

  useEffect(() => {
    fetchLeaves();
  }, [refreshTrigger, filterStatus]);

  const fetchLeaves = async () => {
  try {
    setLoading(true);
    const token = localStorage.getItem('accessToken');

    console.log('🔍 Fetching employee leave history...');

    // Use /my-leaves endpoint for employee's own leaves
    const response = await axios.get('http://localhost:5000/api/leaves/my-leaves', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('✅ Employee leaves fetched:', response.data.length);
    setLeaves(response.data);
    setError('');
    } catch (err) {
      console.error('Error fetching leave history:', err);
      setError(err.response?.data?.message || 'Failed to load leave history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusChip = (state) => {
    const statusConfig = {
      confirm: {
        label: 'Pending',
        color: 'warning',
        icon: <HourglassEmptyIcon fontSize="small" />
      },
      validate: {
        label: 'Approved',
        color: 'success',
        icon: <CheckCircleIcon fontSize="small" />
      },
      refuse: {
        label: 'Rejected',
        color: 'error',
        icon: <CancelIcon fontSize="small" />
      },
      draft: {
        label: 'Draft',
        color: 'default',
        icon: null
      }
    };

    const config = statusConfig[state] || statusConfig.draft;

    return (
      <Chip
        label={config.label}
        color={config.color}
        size="small"
        icon={config.icon}
      />
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleTabChange = (event, newValue) => {
    setFilterStatus(newValue);
  };

  if (loading) {
    return (
      <Card>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Leave History
        </Typography>

        {/* Status Filter Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={filterStatus} onChange={handleTabChange}>
            <Tab label="All" value="all" />
            <Tab label="Pending" value="confirm" />
            <Tab label="Approved" value="validate" />
            <Tab label="Rejected" value="refuse" />
          </Tabs>
        </Box>

        {leaves.length === 0 ? (
          <Alert severity="info">
            No leave requests found.
          </Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Leave Type</strong></TableCell>
                  <TableCell><strong>Start Date</strong></TableCell>
                  <TableCell><strong>End Date</strong></TableCell>
                  <TableCell align="center"><strong>Days</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Remarks</strong></TableCell>
                  <TableCell><strong>Submitted</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leaves.map((leave) => (
                  <TableRow key={leave.id} hover>
                    <TableCell>
                      {leave.holiday_status_id[1]}
                    </TableCell>
                    <TableCell>
                      {formatDate(leave.request_date_from)}
                    </TableCell>
                    <TableCell>
                      {formatDate(leave.request_date_to)}
                    </TableCell>
                    <TableCell align="center">
                      <strong>{leave.number_of_days}</strong>
                    </TableCell>
                    <TableCell>
                      {getStatusChip(leave.state)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {leave.name || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(leave.create_date)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Summary */}
        {leaves.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Showing <strong>{leaves.length}</strong> leave request{leaves.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default LeaveHistoryTable;
