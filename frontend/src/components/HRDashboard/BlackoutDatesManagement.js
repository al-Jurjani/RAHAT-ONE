import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  EventBusy as EventBusyIcon
} from '@mui/icons-material';
import axios from 'axios';

const BlackoutDatesManagement = () => {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const [newPeriod, setNewPeriod] = useState({
    start: '',
    end: '',
    label: ''
  });
  const [addError, setAddError] = useState('');

  useEffect(() => {
    fetchBlackoutDates();
  }, []);

  const fetchBlackoutDates = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      console.log('🔍 Fetching blackout dates...');

      const response = await axios.get(${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/leaves/config/blackout-dates', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = response.data.data || response.data || [];
      console.log('✅ Blackout dates loaded:', data);

      setPeriods(data);
      setHasChanges(false);
      setError('');
    } catch (err) {
      console.error('❌ Failed to load blackout dates:', err);
      setError('Failed to load blackout dates. ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAddPeriod = () => {
    setAddError('');

    if (!newPeriod.start || !newPeriod.end) {
      setAddError('Start date and end date are required.');
      return;
    }

    if (newPeriod.end < newPeriod.start) {
      setAddError('End date cannot be before start date.');
      return;
    }

    const period = {
      start: newPeriod.start,
      end: newPeriod.end,
      label: newPeriod.label.trim() || 'Blackout Period'
    };

    console.log('📝 Adding blackout period:', period);

    setPeriods(prev => [...prev, period]);
    setNewPeriod({ start: '', end: '', label: '' });
    setHasChanges(true);
    setSuccess('');
  };

  const handleDeletePeriod = (index) => {
    console.log(`🗑️ Removing blackout period at index ${index}`);
    setPeriods(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
    setSuccess('');
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const token = localStorage.getItem('accessToken');

      console.log('💾 Saving blackout dates:', periods);

      await axios.put(
        ${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/leaves/config/blackout-dates',
        periods,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('✅ Blackout dates saved successfully');
      setHasChanges(false);
      setSuccess('Blackout dates saved successfully. Flow A will apply these on the next leave submission.');
    } catch (err) {
      console.error('❌ Failed to save blackout dates:', err);
      setError('Failed to save. ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="textSecondary">
          Blackout dates are periods during which leave requests are automatically refused by the policy flow.
          Changes take effect immediately on the next leave submission.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Current Periods Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Label / Reason</strong></TableCell>
              <TableCell><strong>Start Date</strong></TableCell>
              <TableCell><strong>End Date</strong></TableCell>
              <TableCell width={60} align="center"><strong>Remove</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {periods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Box sx={{ py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <EventBusyIcon sx={{ color: 'text.disabled', fontSize: 36 }} />
                    <Typography color="textSecondary">No blackout periods configured</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              periods.map((period, index) => (
                <TableRow key={index} hover>
                  <TableCell>
                    <Chip label={period.label} size="small" color="warning" variant="outlined" />
                  </TableCell>
                  <TableCell>{formatDate(period.start)}</TableCell>
                  <TableCell>{formatDate(period.end)}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeletePeriod(index)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add New Period */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Add New Blackout Period
      </Typography>
      <Divider sx={{ mb: 2 }} />

      {addError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setAddError('')}>
          {addError}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mb: 3 }}>
        <TextField
          label="Start Date"
          type="date"
          size="small"
          value={newPeriod.start}
          onChange={(e) => setNewPeriod({ ...newPeriod, start: e.target.value })}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 180 }}
        />
        <TextField
          label="End Date"
          type="date"
          size="small"
          value={newPeriod.end}
          onChange={(e) => setNewPeriod({ ...newPeriod, end: e.target.value })}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 180 }}
        />
        <TextField
          label="Label / Reason (optional)"
          size="small"
          value={newPeriod.label}
          onChange={(e) => setNewPeriod({ ...newPeriod, label: e.target.value })}
          placeholder="e.g. Year-end closure"
          sx={{ width: 240 }}
        />
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddPeriod}
          disabled={!newPeriod.start || !newPeriod.end}
        >
          Add Period
        </Button>
      </Box>

      {/* Save */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>
    </Box>
  );
};

export default BlackoutDatesManagement;
