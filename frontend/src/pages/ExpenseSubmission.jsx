import React, { useState } from 'react';
import {
  Container,
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { expenseAPI } from '../services/api';

const categoryOptions = [
  { value: 'Medical', label: 'Medical' },
  { value: 'Petrol', label: 'Petrol' },
  { value: 'Travel', label: 'Travel' },
  { value: 'Other', label: 'Other' }
];

const ExpenseSubmission = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    vendor_name: '',
    expense_date: '',
    description: ''
  });

  const [invoiceFile, setInvoiceFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setInvoiceFile(file);
    setErrors(prev => ({ ...prev, invoice: '' }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.amount) newErrors.amount = 'Amount is required';
    if (formData.amount && (Number(formData.amount) <= 0 || Number.isNaN(Number(formData.amount)))) {
      newErrors.amount = 'Amount must be a positive number';
    }
    if (!formData.vendor_name) newErrors.vendor_name = 'Vendor name is required';
    if (!formData.expense_date) newErrors.expense_date = 'Expense date is required';
    if (!formData.description) newErrors.description = 'Description is required';
    if (!invoiceFile) newErrors.invoice = 'Invoice file is required';

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      toast.error('Please fix the highlighted errors');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('category', formData.category);
      submitData.append('amount', formData.amount);
      submitData.append('vendor_name', formData.vendor_name);
      submitData.append('expense_date', formData.expense_date);
      submitData.append('description', formData.description);
      submitData.append('invoice', invoiceFile);

      const response = await expenseAPI.submit(submitData);
      const payload = response?.data?.data || response?.data;

      setSuccessData({
        expenseId: payload?.expenseId || payload?.data?.expenseId,
        status: payload?.status || payload?.data?.status,
        message: payload?.message || 'Expense submitted successfully'
      });

      toast.success('Expense submitted successfully!');

      setFormData({
        category: '',
        amount: '',
        vendor_name: '',
        expense_date: '',
        description: ''
      });
      setInvoiceFile(null);
      setErrors({});

    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to submit expense';
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button
        variant="text"
        onClick={() => navigate('/employee/dashboard')}
        sx={{ mb: 2 }}
      >
        ← Back to Dashboard
      </Button>

      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Submit Expense
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Fill out the form below to submit a new expense reimbursement request.
        </Typography>

        {successData && (
          <Alert severity="success" sx={{ my: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Submission Successful
            </Typography>
            <Typography variant="body2">
              Tracking Reference: <strong>{successData.expenseId || 'Pending'}</strong>
            </Typography>
            <Typography variant="body2">
              Status: {successData.status || 'pending_manager_approval'}
            </Typography>
          </Alert>
        )}

        <Divider sx={{ my: 3 }} />

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                required
                fullWidth
                label="Category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                error={!!errors.category}
                helperText={errors.category}
              >
                {categoryOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="Amount (PKR)"
                name="amount"
                type="number"
                value={formData.amount}
                onChange={handleInputChange}
                error={!!errors.amount}
                helperText={errors.amount}
                inputProps={{ min: 1, step: 1 }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Vendor Name"
                name="vendor_name"
                value={formData.vendor_name}
                onChange={handleInputChange}
                error={!!errors.vendor_name}
                helperText={errors.vendor_name}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="Date of Expense"
                name="expense_date"
                type="date"
                value={formData.expense_date}
                onChange={handleInputChange}
                error={!!errors.expense_date}
                helperText={errors.expense_date}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Description / Reason"
                name="description"
                multiline
                rows={4}
                value={formData.description}
                onChange={handleInputChange}
                error={!!errors.description}
                helperText={errors.description}
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="outlined"
                component="label"
                fullWidth
                sx={{ justifyContent: 'space-between' }}
                color={errors.invoice ? 'error' : 'primary'}
              >
                {invoiceFile ? invoiceFile.name : 'Upload Invoice (PDF/Image)'}
                <input
                  type="file"
                  hidden
                  accept="application/pdf,image/*"
                  onChange={handleFileChange}
                />
              </Button>
              {errors.invoice && (
                <Typography variant="caption" color="error">
                  {errors.invoice}
                </Typography>
              )}
            </Grid>

            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={loading}
                sx={{ py: 1.2 }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Submit Expense'
                )}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
};

export default ExpenseSubmission;
