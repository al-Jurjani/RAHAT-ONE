import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  CircularProgress,
  Box,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { toast } from 'react-toastify';
import { onboardingAPI, lookupAPI } from '../services/api';

function InitiateOnboardingModal({ open, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    email: '',
    departmentId: '',
    jobId: '',
    manualReviewRequired: false
  });

  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      loadDepartments();
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (formData.departmentId) {
      loadPositions(formData.departmentId);
    } else {
      setPositions([]);
      setFormData(prev => ({ ...prev, jobId: '' }));
    }
  }, [formData.departmentId]);

  const loadDepartments = async () => {
    try {
      const response = await lookupAPI.getDepartments();
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
      toast.error('Failed to load departments');
    }
  };

  const loadPositions = async (departmentId) => {
    try {
      const response = await lookupAPI.getPositions(departmentId);
      setPositions(response.data.data || []);
    } catch (error) {
      console.error('Failed to load positions:', error);
      toast.error('Failed to load positions');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      departmentId: '',
      jobId: '',
      manualReviewRequired: false
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.departmentId) {
      newErrors.departmentId = 'Department is required';
    }

    if (!formData.jobId) {
      newErrors.jobId = 'Position is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email: formData.email.trim(),
        departmentId: parseInt(formData.departmentId),
        jobId: parseInt(formData.jobId),
        manualReviewRequired: formData.manualReviewRequired
      };

      const response = await onboardingAPI.initiate(payload);

      if (response.data.success) {
        toast.success(
          `Onboarding initiated! An invitation email will be sent to ${formData.email.trim()}`
        );
        resetForm();
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      console.error('Failed to initiate onboarding:', error);
      const errorMessage = error.response?.data?.message || 'Failed to initiate onboarding';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Initiate Employee Onboarding</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <TextField
            fullWidth
            required
            type="email"
            label="Candidate's Personal Email"
            value={formData.email}
            onChange={handleChange('email')}
            error={!!errors.email}
            helperText={errors.email || 'An invitation link will be sent to this address'}
            disabled={loading}
          />

          <TextField
            fullWidth
            required
            select
            label="Department"
            value={formData.departmentId}
            onChange={handleChange('departmentId')}
            error={!!errors.departmentId}
            helperText={errors.departmentId}
            disabled={loading}
          >
            <MenuItem value="">
              <em>Select Department</em>
            </MenuItem>
            {departments.map((dept) => (
              <MenuItem key={dept.id} value={dept.id}>
                {dept.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            required
            select
            label="Position"
            value={formData.jobId}
            onChange={handleChange('jobId')}
            error={!!errors.jobId}
            helperText={errors.jobId || (!formData.departmentId ? 'Select a department first' : '')}
            disabled={loading || !formData.departmentId}
          >
            <MenuItem value="">
              <em>Select Position</em>
            </MenuItem>
            {positions.map((pos) => (
              <MenuItem key={pos.id} value={pos.id}>
                {pos.name}
              </MenuItem>
            ))}
          </TextField>

          <FormControlLabel
            control={
              <Checkbox
                checked={formData.manualReviewRequired}
                onChange={(e) => setFormData(prev => ({ ...prev, manualReviewRequired: e.target.checked }))}
                disabled={loading}
              />
            }
            label="Require manual approval (skip auto-approve even if all checks pass)"
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Initiate Onboarding'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default InitiateOnboardingModal;
