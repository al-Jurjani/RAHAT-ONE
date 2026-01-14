/**
 * LeaveBalanceCard Component
 * Path: frontend/src/components/leave/LeaveBalanceCard.jsx
 *
 * Displays employee's leave balance with visual progress bar
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  CircularProgress,
  Alert,
  Stack
} from '@mui/material';
import {
  EventAvailable as EventAvailableIcon,
  Event as EventIcon,
  EventBusy as EventBusyIcon
} from '@mui/icons-material';
import axios from 'axios';

const LeaveBalanceCard = ({ refreshTrigger = 0 }) => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBalance();
  }, [refreshTrigger]); // Refetch when refreshTrigger changes

  const fetchBalance = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('accessToken');
      const response = await axios.get('http://localhost:5000/api/leaves/balance', {
        headers: { Authorization: `Bearer ${token}` }
      });

      setBalance(response.data.data);
    } catch (err) {
      console.error('Error fetching leave balance:', err);
      setError(err.response?.data?.message || 'Failed to load leave balance');
    } finally {
      setLoading(false);
    }
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

  if (!balance) {
    return null;
  }

  const { total, used, remaining } = balance;
  const usagePercentage = total > 0 ? (used / total) * 100 : 0;

  // Color based on remaining percentage
  const getProgressColor = () => {
    const remainingPercentage = (remaining / total) * 100;
    if (remainingPercentage > 50) return 'success';
    if (remainingPercentage > 20) return 'warning';
    return 'error';
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Annual Leave Balance
        </Typography>

        {/* Progress Bar */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {used} of {total} days used
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {remaining} days remaining
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={usagePercentage}
            color={getProgressColor()}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>

        {/* Stats Grid */}
        <Stack spacing={2}>
          {/* Total Allocated */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventIcon color="primary" />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Total Allocated
              </Typography>
              <Typography variant="h6">{total} days</Typography>
            </Box>
          </Box>

          {/* Used */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventBusyIcon color="error" />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Used
              </Typography>
              <Typography variant="h6">{used} days</Typography>
            </Box>
          </Box>

          {/* Remaining */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventAvailableIcon color="success" />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Remaining
              </Typography>
              <Typography variant="h6" color={getProgressColor()}>
                {remaining} days
              </Typography>
            </Box>
          </Box>
        </Stack>

        {/* Warning if low balance */}
        {remaining <= 3 && remaining > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Low leave balance! Only {remaining} day{remaining !== 1 ? 's' : ''} remaining.
          </Alert>
        )}

        {remaining === 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            No leave days remaining. Contact HR for assistance.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default LeaveBalanceCard;
