import React, { useState } from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import { toast } from 'react-toastify';
import { expenseAPI } from '../services/api';
import ExpenseHistoryTable from '../components/expense/ExpenseHistoryTable';
import AppShell from '../components/layout/AppShell';
import { Card, Button, FormField } from '../components/ui';

const categoryOptions = [
  { value: 'Medical', label: 'Medical' },
  { value: 'Petrol', label: 'Petrol' },
  { value: 'Travel', label: 'Travel' },
  { value: 'Other', label: 'Other' },
];

const ExpenseSubmission = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    vendor_name: '',
    expense_date: '',
    description: '',
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
        message: payload?.message || 'Expense submitted successfully',
      });

      toast.success('Expense submitted successfully!');
      setFormData({ category: '', amount: '', vendor_name: '', expense_date: '', description: '' });
      setInvoiceFile(null);
      setErrors({});
      setRefreshTrigger((prev) => prev + 1);
      setActiveTab(1);
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to submit expense';
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell pageTitle="My Expenses">
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        marginBottom: 'var(--space-6)',
      }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Submit Expense" />
          <Tab label="Expense History" />
        </Tabs>
      </div>

      {activeTab === 0 && (
        <div style={{ maxWidth: 720, marginBottom: 'var(--space-6)' }}>
          <Card header="New Expense Claim">
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '0 0 var(--space-5)' }}>
              Fill out the form below to submit a new expense reimbursement request.
            </p>

            {successData && (
              <div style={{
                background: 'var(--status-success-bg)',
                border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                marginBottom: 'var(--space-5)',
                color: 'var(--status-success)',
                fontSize: 'var(--text-sm)',
              }}>
                <strong>Submission Successful</strong><br />
                Tracking Reference: <strong>{successData.expenseId || 'Pending'}</strong><br />
                Status: {successData.status || 'pending_manager_approval'}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <FormField
                  label="Category"
                  type="select"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  error={errors.category}
                  required
                >
                  <option value="">Select category…</option>
                  {categoryOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </FormField>

                <FormField
                  label="Amount (PKR)"
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  error={errors.amount}
                  placeholder="e.g. 5000"
                  required
                />
              </div>

              <FormField
                label="Vendor Name"
                name="vendor_name"
                value={formData.vendor_name}
                onChange={handleInputChange}
                error={errors.vendor_name}
                placeholder="e.g. Shifa International Hospital"
                required
              />

              <FormField
                label="Date of Expense"
                type="date"
                name="expense_date"
                value={formData.expense_date}
                onChange={handleInputChange}
                error={errors.expense_date}
                required
              />

              <FormField
                label="Description / Reason"
                type="textarea"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                error={errors.description}
                placeholder="Briefly explain the expense…"
                required
              />

              <div style={{ marginTop: 'var(--space-4)' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                  Invoice <span style={{ color: 'var(--status-danger)' }}>*</span>
                </div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${errors.invoice ? 'var(--status-danger)' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  color: invoiceFile ? 'var(--text-primary)' : 'var(--text-muted)',
                }}>
                  <span>{invoiceFile ? invoiceFile.name : 'Upload Invoice (PDF / Image)'}</span>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>Browse</span>
                  <input
                    type="file"
                    hidden
                    accept="application/pdf,image/*"
                    onChange={handleFileChange}
                  />
                </label>
                {errors.invoice && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--status-danger)', marginTop: 'var(--space-1)', display: 'block' }}>
                    {errors.invoice}
                  </span>
                )}
              </div>

              <div style={{ marginTop: 'var(--space-6)' }}>
                <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                  Submit Expense
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {activeTab === 1 && (
        <ExpenseHistoryTable refreshTrigger={refreshTrigger} />
      )}
    </AppShell>
  );
};

export default ExpenseSubmission;
