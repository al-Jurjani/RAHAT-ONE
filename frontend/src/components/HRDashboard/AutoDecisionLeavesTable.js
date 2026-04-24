import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, CircularProgress, Alert, Typography, Box,
} from '@mui/material';
import axios from 'axios';

const ENDPOINT = {
  auto_approved: `${API_BASE_URL}/leaves/auto-approved`,
  auto_rejected: `${API_BASE_URL}/leaves/auto-rejected`,
};

const CONFIG = {
  auto_approved: {
    emptyText: 'No auto-approved leaves on record.',
    chipLabel: 'Auto-Approved',
    chipColor: 'success',
  },
  auto_rejected: {
    emptyText: 'No auto-rejected leaves on record.',
    chipLabel: 'Auto-Rejected',
    chipColor: 'error',
  },
};

const AutoDecisionLeavesTable = ({ type }) => {
  const [leaves, setLeaves]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const cfg = CONFIG[type] || CONFIG.auto_approved;

  const fetchLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const { data } = await axios.get(ENDPOINT[type], {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLeaves(data);
      setError('');
    } catch {
      setError('Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
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
              <TableCell><strong>Leave Type</strong></TableCell>
              <TableCell><strong>From</strong></TableCell>
              <TableCell><strong>To</strong></TableCell>
              <TableCell><strong>Days</strong></TableCell>
              <TableCell><strong>Decision</strong></TableCell>
              <TableCell><strong>Submitted</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {leaves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="textSecondary">{cfg.emptyText}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              leaves.map((leave) => (
                <TableRow key={leave.id} hover>
                  <TableCell>{leave.employee_id[1]}</TableCell>
                  <TableCell>
                    <Chip label={leave.holiday_status_id[1]} size="small" color="primary" />
                  </TableCell>
                  <TableCell>{leave.request_date_from}</TableCell>
                  <TableCell>{leave.request_date_to}</TableCell>
                  <TableCell>{leave.number_of_days}</TableCell>
                  <TableCell>
                    <Chip label={cfg.chipLabel} size="small" color={cfg.chipColor} />
                  </TableCell>
                  <TableCell>{new Date(leave.create_date).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};

export default AutoDecisionLeavesTable;
