/**
 * LeaveRequestForm Component
 * Path: frontend/src/components/leave/LeaveRequestForm.jsx
 *
 * Form for submitting new leave requests
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Send as SendIcon } from '@mui/icons-material';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const LeaveRequestForm = ({ onSubmitSuccess }) => {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [formData, setFormData] = useState({
    leave_type_id: '',
    date_from: null,
    date_to: null,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [typesLoading, setTypesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_BASE_URL}/leaves/types`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setLeaveTypes(response.data);
    } catch (err) {
      console.error('Error fetching leave types:', err);
      setError('Failed to load leave types');
    } finally {
      setTypesLoading(false);
    }
  };

  const calculateDays = () => {
    if (!formData.date_from || !formData.date_to) return 0;

    const from = new Date(formData.date_from);
    const to = new Date(formData.date_to);

    // Calculate difference in days
    const diffTime = Math.abs(to - from);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end date

    return diffDays;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // DEBUG: Check token
    const token = localStorage.getItem('accessToken');
    console.log('🔍 Token exists?', !!token);
    console.log('🔍 Token value (first 50 chars):', token?.substring(0, 50));

    const decoded = JSON.parse(atob(token.split('.')[1]));
    console.log('🔍 Logged in as employee_id:', decoded.employee_id);

    // Validation
    if (!formData.leave_type_id) {
      setError('Please select a leave type');
      return;
    }

    if (!formData.date_from || !formData.date_to) {
      setError('Please select both start and end dates');
      return;
    }

    if (new Date(formData.date_from) > new Date(formData.date_to)) {
      setError('End date must be after start date');
      return;
    }

    const numberOfDays = calculateDays();

    if (numberOfDays <= 0) {
      setError('Invalid date range');
      return;
    }

    try {
      setLoading(true);

      const token = localStorage.getItem('accessToken');

      // Format dates as YYYY-MM-DD
      const dateFrom = formData.date_from.toISOString().split('T')[0];
      const dateTo = formData.date_to.toISOString().split('T')[0];

      await axios.post(
        `${API_BASE_URL}/leaves`,
        {
          leave_type_id: parseInt(formData.leave_type_id),
          date_from: dateFrom,
          date_to: dateTo,
          number_of_days: numberOfDays,
          notes: formData.notes || 'Leave Request'
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setSuccess(true);

      // Reset form
      setFormData({
        leave_type_id: '',
        date_from: null,
        date_to: null,
        notes: ''
      });

      // Call parent callback
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      console.error('Error submitting leave request:', err);
      setError(err.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setLoading(false);
    }
  };

  const numberOfDays = calculateDays();

  if (typesLoading) {
    return (
      <Card>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Request Leave
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Leave request submitted successfully! Pending approval.
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            {/* Leave Type */}
            <FormControl fullWidth required>
              <InputLabel>Leave Type</InputLabel>
              <Select
                value={formData.leave_type_id}
                onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
                label="Leave Type"
              >
                {leaveTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Date Range */}
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <DatePicker
                  label="Start Date"
                  value={formData.date_from}
                  onChange={(newValue) => setFormData({ ...formData, date_from: newValue })}
                  renderInput={(params) => <TextField {...params} fullWidth required />}
                  minDate={new Date()} // Can't select past dates
                  sx={{ flex: 1, minWidth: 200 }}
                />

                <DatePicker
                  label="End Date"
                  value={formData.date_to}
                  onChange={(newValue) => setFormData({ ...formData, date_to: newValue })}
                  renderInput={(params) => <TextField {...params} fullWidth required />}
                  minDate={formData.date_from || new Date()} // End date must be after start date
                  sx={{ flex: 1, minWidth: 200 }}
                />
              </Box>
            </LocalizationProvider>

            {/* Days Calculation Display */}
            {numberOfDays > 0 && (
              <Alert severity="info">
                <strong>{numberOfDays}</strong> day{numberOfDays !== 1 ? 's' : ''} selected
              </Alert>
            )}

            {/* Notes */}
            <TextField
              label="Notes (Optional)"
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Reason for leave request..."
              fullWidth
            />

            {/* Submit Button */}
            <Button
              type="submit"
              variant="contained"
              size="large"
              startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
              disabled={loading || !formData.leave_type_id || !formData.date_from || !formData.date_to}
              fullWidth
            >
              {loading ? 'Submitting...' : 'Submit Leave Request'}
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

export default LeaveRequestForm;
