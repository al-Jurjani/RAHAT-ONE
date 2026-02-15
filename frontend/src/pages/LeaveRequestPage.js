import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Typography, TextField, Button,
  Alert, Box, MenuItem, CircularProgress
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import api from '../services/api';

export default function LeaveRequestPage() {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const [formData, setFormData] = useState({
    leave_type_id: 1, // Annual Leave
    date_from: null,
    date_to: null,
    notes: ''
  });

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const response = await api.get('/leaves/balance');
      setBalance(response.data);
    } catch (error) {
      console.error('Balance fetch error:', error);
    }
  };

  const calculateDays = () => {
    if (!formData.date_from || !formData.date_to) return 0;

    const from = dayjs(formData.date_from);
    const to = dayjs(formData.date_to);

    return to.diff(from, 'day') + 1;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const days = calculateDays();

      if (days <= 0) {
        throw new Error('Invalid date range');
      }

      if (balance && days > balance.remaining) {
        throw new Error('Insufficient leave balance');
      }

      await api.post('/leaves', {
        ...formData,
        date_from: dayjs(formData.date_from).format('YYYY-MM-DD'),
        date_to: dayjs(formData.date_to).format('YYYY-MM-DD'),
        number_of_days: days
      });

      setMessage({ type: 'success', text: 'Leave request submitted successfully!' });

      // Reset form
      setFormData({
        leave_type_id: 1,
        date_from: null,
        date_to: null,
        notes: ''
      });

      fetchBalance();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Leave Request
        </Typography>

        {/* Leave Balance Display */}
        {balance && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
            <Typography variant="body1">
              <strong>Total Leave:</strong> {balance.total} days
            </Typography>
            <Typography variant="body1">
              <strong>Used:</strong> {balance.used} days
            </Typography>
            <Typography variant="body1" color="success.main">
              <strong>Remaining:</strong> {balance.remaining} days
            </Typography>
          </Box>
        )}

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              select
              label="Leave Type"
              value={formData.leave_type_id}
              onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
              sx={{ mb: 2 }}
              required
            >
              <MenuItem value={1}>Annual Leave</MenuItem>
              <MenuItem value={2}>Sick Leave</MenuItem>
              <MenuItem value={3}>Emergency Leave</MenuItem>
            </TextField>

            <DatePicker
              label="From Date"
              value={formData.date_from}
              onChange={(date) => setFormData({ ...formData, date_from: date })}
              slotProps={{ textField: { fullWidth: true, required: true, sx: { mb: 2 } } }}
              minDate={dayjs()}
            />

            <DatePicker
              label="To Date"
              value={formData.date_to}
              onChange={(date) => setFormData({ ...formData, date_to: date })}
              slotProps={{ textField: { fullWidth: true, required: true, sx: { mb: 2 } } }}
              minDate={formData.date_from || dayjs()}
            />

            {formData.date_from && formData.date_to && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Duration: {calculateDays()} day(s)
              </Typography>
            )}

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Reason (optional)"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading || !formData.date_from || !formData.date_to}
            >
              {loading ? <CircularProgress size={24} /> : 'Submit Leave Request'}
            </Button>
          </form>
        </LocalizationProvider>
      </Paper>
    </Container>
  );
}
