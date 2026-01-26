import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Grid,
  LinearProgress,
  Chip
} from '@mui/material';
import axios from 'axios';

const LeaveBalanceCard = () => {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBalances();
  }, []);

  const fetchBalances = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      console.log('🔍 Fetching leave types...');

      // First get all leave types
      const typesResponse = await axios.get('http://localhost:5000/api/leaves/types', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const types = typesResponse.data;
      console.log('✅ Leave types:', types);

      // Then get balance for each type
      const balancePromises = types.map(async (type) => {
        try {
          const balanceResponse = await axios.get(
            `http://localhost:5000/api/leaves/balance?leave_type_id=${type.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          return {
            ...type,
            balance: balanceResponse.data.data || balanceResponse.data
          };
        } catch (err) {
          console.error(`Error fetching balance for ${type.name}:`, err);
          return {
            ...type,
            balance: { total: 0, used: 0, remaining: 0 }
          };
        }
      });

      const balancesWithTypes = await Promise.all(balancePromises);
      console.log('✅ Balances fetched:', balancesWithTypes);

      setBalances(balancesWithTypes);
      setError(null);
    } catch (err) {
      console.error('❌ Error fetching balances:', err);
      setError('Failed to load leave balances');
    } finally {
      setLoading(false);
    }
  };

  const getColorForType = (name) => {
    const colors = {
      'Annual Leave': 'primary',
      'Sick Leave': 'warning',
      'Emergency Leave': 'error',
      'Unpaid Leave': 'default'
    };
    return colors[name] || 'info';
  };

  const calculatePercentage = (used, total) => {
    if (total === 0) return 0;
    return (used / total) * 100;
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
          Leave Balances
        </Typography>

        <Grid container spacing={2} sx={{ mt: 1 }}>
          {balances.map((item) => {
            const { balance } = item;
            const percentage = calculatePercentage(balance.used, balance.total);

            return (
              <Grid item xs={12} sm={6} key={item.id}>
                <Box
                  sx={{
                    p: 2,
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    backgroundColor: balance.remaining === 0 ? '#fff3e0' : '#fff'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {item.name}
                    </Typography>
                    <Chip
                      label={`${balance.remaining} days left`}
                      color={balance.remaining > 5 ? 'success' : balance.remaining > 0 ? 'warning' : 'error'}
                      size="small"
                    />
                  </Box>

                  <Box sx={{ mb: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={percentage}
                      sx={{
                        height: 8,
                        borderRadius: 1,
                        backgroundColor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: balance.remaining > 5 ? '#4caf50' : balance.remaining > 0 ? '#ff9800' : '#f44336'
                        }
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="body2" color="textSecondary">
                      Total: <strong>{balance.total}</strong>
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Used: <strong>{balance.used}</strong>
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Available: <strong>{balance.remaining}</strong>
                    </Typography>
                  </Box>

                  {balance.total === 0 && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      No allocation for this leave type. Contact HR.
                    </Alert>
                  )}
                </Box>
              </Grid>
            );
          })}
        </Grid>

        {balances.length === 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            No leave types available. Contact HR for leave allocations.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default LeaveBalanceCard;
