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
    name: '',
    email: '',
    phone: '',
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
      name: '',
      email: '',
      phone: '',
      departmentId: '',
      jobId: '',
      manualReviewRequired: false
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
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
        name: formData.name.trim(),
        email: formData.email.trim(),
        ...(formData.phone && { phone: formData.phone.trim() }),
        ...(formData.departmentId && { departmentId: parseInt(formData.departmentId) }),
        ...(formData.jobId && { jobId: parseInt(formData.jobId) }),
        manualReviewRequired: formData.manualReviewRequired
      };

      const response = await onboardingAPI.initiate(payload);

      if (response.data.success) {
        const employeeData = response.data.data;
        toast.success(
          `Onboarding initiated successfully! Employee ID: ${employeeData.employeeId}. An email has been sent to ${employeeData.email}`
        );
        resetForm();
        onClose();
        if (onSuccess) {
          onSuccess(employeeData);
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
            label="Full Name"
            value={formData.name}
            onChange={handleChange('name')}
            error={!!errors.name}
            helperText={errors.name}
            disabled={loading}
          />

          <TextField
            fullWidth
            required
            type="email"
            label="Personal Email Address"
            value={formData.email}
            onChange={handleChange('email')}
            error={!!errors.email}
            helperText={errors.email || 'An email will be sent to this address'}
            disabled={loading}
          />

          <TextField
            fullWidth
            label="Phone Number"
            value={formData.phone}
            onChange={handleChange('phone')}
            disabled={loading}
          />

          <TextField
            fullWidth
            select
            label="Department"
            value={formData.departmentId}
            onChange={handleChange('departmentId')}
            disabled={loading}
          >
            <MenuItem value="">
              <em>Select Department (Optional)</em>
            </MenuItem>
            {departments.map((dept) => (
              <MenuItem key={dept.id} value={dept.id}>
                {dept.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            select
            label="Position"
            value={formData.jobId}
            onChange={handleChange('jobId')}
            disabled={loading || !formData.departmentId}
            helperText={!formData.departmentId ? 'Select a department first' : ''}
          >
            <MenuItem value="">
              <em>Select Position (Optional)</em>
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
