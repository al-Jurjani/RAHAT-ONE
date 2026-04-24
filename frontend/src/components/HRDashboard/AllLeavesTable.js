import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
} from '@mui/material';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AllLeavesTable = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  // Log column removed — no longer used

  const fetchLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      let url = `${API_BASE_URL}/leaves`;
      if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setLeaves(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load leaves');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const getStatusColor = (state) => {
    switch (state) {
      case 'validate':  return 'success';
      case 'validate1': return 'info';
      case 'refuse':    return 'error';
      case 'confirm':   return 'warning';
      default:          return 'default';
    }
  };

  const getStatusLabel = (state) => {
    switch (state) {
      case 'validate':  return 'Approved';
      case 'validate1': return 'Pending HR';
      case 'refuse':    return 'Rejected';
      case 'confirm':   return 'Pending';
      default:          return state;
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

      <Box sx={{ mb: 2 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Status Filter</InputLabel>
          <Select
            value={statusFilter}
            label="Status Filter"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All Leaves</MenuItem>
            <MenuItem value="confirm">Pending Manager</MenuItem>
            <MenuItem value="validate1">Pending HR</MenuItem>
            <MenuItem value="validate">Approved</MenuItem>
            <MenuItem value="refuse">Rejected</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Employee</strong></TableCell>
              <TableCell><strong>Leave Type</strong></TableCell>
              <TableCell><strong>From</strong></TableCell>
              <TableCell><strong>To</strong></TableCell>
              <TableCell><strong>Days</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Submitted</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {leaves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="textSecondary">No leaves found</Typography>
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
                    <Chip
                      label={getStatusLabel(leave.state)}
                      size="small"
                      color={getStatusColor(leave.state)}
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(leave.create_date).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

    </>
  );
};

export default AllLeavesTable;
