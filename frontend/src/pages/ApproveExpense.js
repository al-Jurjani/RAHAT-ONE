import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Container,
  Paper,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Box,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DescriptionIcon from '@mui/icons-material/Description';

const API_BASE_URL = 'http://localhost:5000';

const ApproveExpense = () => {
  const { expenseId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [expense, setExpense] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const fetchExpenseDetails = useCallback(async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/expenses/public/${expenseId}`,
        { params: { token } }
      );

      const { expense: expenseData, employee: employeeData } = response.data.data;
      setExpense(expenseData);
      setEmployee(employeeData);
      setLoading(false);
    } catch (err) {
      console.error('Fetch expense error:', err);
      setError(err.response?.data?.message || 'Invalid or expired link');
      setLoading(false);
    }
  }, [expenseId, token]);

  useEffect(() => {
    if (!token) {
      setError('Approval token is missing from the link');
      setLoading(false);
      return;
    }
    fetchExpenseDetails();
  }, [token, fetchExpenseDetails]);

  const loadInvoicePreview = async () => {
    try {
      setInvoiceLoading(true);

      // Use public endpoint with token
      const response = await axios.get(
        `${API_BASE_URL}/api/expenses/public/${expenseId}/invoice`,
        {
          params: { token },
          responseType: 'blob'
        }
      );

      const blob = response.data;

      // Detect file type
      const mimeType = blob.type || 'application/octet-stream';
      const isPDF = mimeType.includes('pdf');
      const isImage = mimeType.startsWith('image/');

      if (isPDF || isImage) {
        const url = URL.createObjectURL(blob);
        setInvoicePreview({
          url,
          type: isPDF ? 'pdf' : 'image',
          mimeType
        });
        setPreviewDialogOpen(true);
      } else {
        // For other file types, just download
        const fileName = `expense-${expenseId}-invoice`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
      }
    } catch (err) {
      console.error('Invoice preview error:', err);
      setError('Failed to load invoice preview. This link may have expired or is invalid.');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleDecision = async (decision) => {
    try {
      setActionLoading(true);
      await axios.post(
        `${API_BASE_URL}/api/expenses/${expenseId}/manager-decision`,
        {
          token: token,
          decision: decision,
          remarks: remarks || `${decision === 'approve' ? 'Approved' : 'Rejected'} by manager`
        }
      );

      setResult({
        success: true,
        decision: decision,
        message: `Expense ${decision === 'approve' ? 'approved' : 'rejected'} successfully!`,
        nextAction: null
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process decision');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg-base)', display: 'flex', alignItems: 'center' }}>
        <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <CircularProgress />
        </Container>
      </Box>
    );
  }

  if (result) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg-base)', py: 8 }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: 4, textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
          {result.decision === 'approve' ? (
            <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          ) : (
            <CancelIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
          )}
          <Typography
            variant="h5"
            color={result.decision === 'approve' ? 'success.main' : 'error.main'}
            gutterBottom
          >
            {result.message}
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
            The employee and HR have been notified of your decision.
          </Typography>
          {result.nextAction && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Next Step: {result.nextAction}
            </Alert>
          )}
        </Paper>
      </Container>
      </Box>
    );
  }

  if (error || !expense || !employee) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg-base)', py: 8 }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: 4, textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
          <CancelIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
          <Typography variant="h6" color="error" gutterBottom>
            {error || 'Expense request not found'}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            This link may have expired or is invalid.
          </Typography>
        </Paper>
      </Container>
      </Box>
    );
  }

  const thresholdAmount = 5000; // Define your threshold
  const isHighAmount = expense.total_amount > thresholdAmount;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg-base)', py: 8 }}>
    <Container maxWidth="sm" sx={{ mb: 4 }}>
      <Paper sx={{ p: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
        <Typography variant="h4" gutterBottom align="center" color="primary">
          Expense Approval Request
        </Typography>

        <Box sx={{ my: 3, p: 2, bgcolor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
          {/* Employee Name */}
          <Typography variant="h6" gutterBottom>
            {employee.name}
          </Typography>

          {/* Category & Amount Chips */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip
              label={expense.expense_category || 'Uncategorized'}
              color="primary"
              size="small"
            />
            <Chip
              label={`PKR ${expense.total_amount?.toLocaleString('en-PK') || '0'}`}
              color={isHighAmount ? 'error' : 'success'}
              variant={isHighAmount ? 'filled' : 'outlined'}
              size="small"
            />
          </Box>

          {/* Vendor Name */}
          <Typography variant="body2" color="textSecondary" gutterBottom>
            <strong>Vendor:</strong> {expense.vendor_name || 'N/A'}
          </Typography>

          {/* Expense Date */}
          <Typography variant="body2" color="textSecondary" gutterBottom>
            <strong>Date:</strong> {new Date(expense.expense_date || expense.create_date).toLocaleDateString('en-PK')}
          </Typography>

          {/* Description */}
          <Typography variant="body2" color="textSecondary" gutterBottom>
            <strong>Description:</strong> {expense.description || 'No description provided'}
          </Typography>

          {/* Invoice Preview Button */}
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid var(--border-subtle)' }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={invoiceLoading ? <CircularProgress size={20} /> : <DescriptionIcon />}
              onClick={loadInvoicePreview}
              disabled={invoiceLoading}
              sx={{ mb: 1 }}
            >
              {invoiceLoading ? 'Loading Invoice...' : 'View Invoice'}
            </Button>
            <Typography variant="caption" color="textSecondary" display="block" textAlign="center">
              Click to preview attached invoice/receipt
            </Typography>
          </Box>
        </Box>

        {/* Invoice Preview Dialog */}
        <Dialog
          open={previewDialogOpen}
          onClose={() => setPreviewDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {invoicePreview?.type === 'pdf' ? 'Invoice (PDF)' : 'Invoice Image'}
          </DialogTitle>
          <DialogContent dividers>
            {invoicePreview?.type === 'pdf' ? (
              <iframe
                src={invoicePreview.url}
                style={{ width: '100%', height: '500px', border: 'none' }}
                title="Invoice PDF"
              />
            ) : (
              <img
                src={invoicePreview?.url}
                alt="Invoice"
                style={{ width: '100%', height: 'auto' }}
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
            <Button
              variant="contained"
              startIcon={<FileDownloadIcon />}
              onClick={() => {
                const link = document.createElement('a');
                link.href = invoicePreview.url;
                link.download = `expense-${expenseId}-invoice`;
                link.click();
              }}
            >
              Download
            </Button>
          </DialogActions>
        </Dialog>

        {/* Remarks Field */}
        <TextField
          fullWidth
          label="Remarks (Optional)"
          placeholder="Add any comments or conditions for your decision..."
          multiline
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          sx={{ mb: 3 }}
        />

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            fullWidth
            variant="contained"
            color="success"
            size="large"
            onClick={() => handleDecision('approve')}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            Approve
          </Button>

          <Button
            fullWidth
            variant="contained"
            color="error"
            size="large"
            onClick={() => handleDecision('reject')}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <CancelIcon />}
          >
            Reject
          </Button>
        </Box>
      </Paper>
    </Container>
    </Box>
  );
};

export default ApproveExpense;
