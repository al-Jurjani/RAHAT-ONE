import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  IconButton
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import DescriptionIcon from '@mui/icons-material/Description';
import axios from 'axios';
import { expenseAPI } from '../../services/api';

const API_BASE_URL = 'http://localhost:5000/api';

const getPreviewType = (mimetype, name) => {
  const lowerName = (name || '').toLowerCase();
  if (mimetype?.includes('pdf') || lowerName.endsWith('.pdf')) return 'pdf';
  if (mimetype?.startsWith('image/') || lowerName.match(/\.(png|jpg|jpeg|gif|webp)$/i)) return 'image';
  return 'file';
};

const PendingExpensesTable = ({ refreshTrigger, onActionComplete }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [action, setAction] = useState('');
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedExpenseId, setExpandedExpenseId] = useState(null);
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 960);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 960);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchPendingExpenses();
  }, [refreshTrigger]);

  const fetchPendingExpenses = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const response = await axios.get(
        `${API_BASE_URL}/expenses/pending-approval?type=hr`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setExpenses(response.data.data.expenses || []);
      setError('');
    } catch (err) {
      setError('Failed to load pending expenses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusChip = (status) => {
    const statusMap = {
      'pending_manager': { label: 'Pending Manager', color: 'warning' },
      'pending_hr': { label: 'Pending HR', color: 'info' },
      'approved': { label: 'Approved', color: 'success' },
      'rejected': { label: 'Rejected', color: 'error' },
      'draft': { label: 'Draft', color: 'default' }
    };

    const config = statusMap[status] || { label: status, color: 'default' };
    return <Chip label={config.label} size="small" color={config.color} variant="outlined" />;
  };

  const handleAction = (expense, actionType) => {
    setSelectedExpense(expense);
    setAction(actionType);
    setRemarks('');
    setDialogOpen(true);
  };

  const loadInvoicePreview = async (expenseId) => {
    try {
      setInvoiceLoading(true);
      const response = await expenseAPI.getAttachment(expenseId);
      const blob = response?.data;

      if (!blob || !(blob instanceof Blob) || blob.size === 0) {
        throw new Error('Attachment not available');
      }

      const fileName = response?.headers?.['content-disposition'] || '';
      const type = getPreviewType(blob.type, fileName);

      if (type === 'file') {
        throw new Error('Unsupported file type');
      }

      const url = URL.createObjectURL(blob);
      setInvoicePreview({
        url,
        type,
        expenseId
      });
      setPreviewDialogOpen(true);
    } catch (err) {
      console.error('Invoice preview error:', err);
      setError('Failed to load invoice preview');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const confirmAction = async () => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('accessToken');

      await axios.post(
        `${API_BASE_URL}/expenses/${selectedExpense.id}/hr-decision`,
        {
          decision: action,
          remarks: remarks || `${action === 'approve' ? 'Approved' : 'Rejected'} by HR`
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Refresh list
      fetchPendingExpenses();
      setDialogOpen(false);
      if (onActionComplete) onActionComplete();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process decision');
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (expenses.length === 0) {
    return (
      <Alert severity="info">
        No expenses pending HR approval at this time.
      </Alert>
    );
  }

  // Mobile Card View
  if (isMobile) {
    return (
      <>
        <Grid container spacing={2}>
          {expenses.map((expense) => (
            <Grid item xs={12} key={expense.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                      <Typography variant="h6">{expense.employeeName}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {expense.vendor_name}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" color="primary">
                        PKR {(expense.total_amount || 0).toLocaleString('en-PK')}
                      </Typography>
                      {getStatusChip(expense.workflow_status)}
                    </Box>
                  </Box>

                  <Box sx={{ my: 1 }}>
                    <Chip label={expense.expense_category} size="small" sx={{ mr: 1 }} />
                    <Chip label={`Fraud: N/A`} size="small" color="default" variant="outlined" />
                  </Box>

                  <Typography variant="body2" color="textSecondary">
                    <strong>Date:</strong> {new Date(expense.expense_date || expense.create_date).toLocaleDateString('en-PK')}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                    <strong>Description:</strong> {expense.description || 'N/A'}
                  </Typography>

                  {/* Expandable section */}
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #eee' }}>
                    <Button
                      fullWidth
                      size="small"
                      onClick={() => setExpandedExpenseId(expandedExpenseId === expense.id ? null : expense.id)}
                      endIcon={expandedExpenseId === expense.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    >
                      {expandedExpenseId === expense.id ? 'Hide' : 'Show'} Invoice
                    </Button>

                    {expandedExpenseId === expense.id && (
                      <Box sx={{ mt: 2 }}>
                        <Button
                          fullWidth
                          size="small"
                          variant="outlined"
                          disabled={invoiceLoading}
                          onClick={() => loadInvoicePreview(expense.id)}
                          sx={{ mb: 2 }}
                        >
                          {invoiceLoading ? <CircularProgress size={16} /> : 'View Invoice'}
                        </Button>
                      </Box>
                    )}
                  </Box>

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      fullWidth
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => handleAction(expense, 'approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      fullWidth
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => handleAction(expense, 'reject')}
                    >
                      Reject
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Decision Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>
            {action === 'approve' ? 'Approve Expense' : 'Reject Expense'}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2, mt: 1 }}>
              <strong>Employee:</strong> {selectedExpense?.employeeName}<br />
              <strong>Amount:</strong> PKR {(selectedExpense?.total_amount || 0).toLocaleString('en-PK')}<br />
              <strong>Category:</strong> {selectedExpense?.expense_category}
            </Typography>

            <TextField
              fullWidth
              label="Remarks (Optional)"
              multiline
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={`Enter ${action === 'approve' ? 'approval' : 'rejection'} remarks...`}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              variant="contained"
              color={action === 'approve' ? 'success' : 'error'}
              disabled={actionLoading}
            >
              {actionLoading ? <CircularProgress size={20} /> : `Confirm ${action === 'approve' ? 'Approval' : 'Rejection'}`}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Invoice Preview Dialog */}
        <Dialog
          open={previewDialogOpen}
          onClose={() => setPreviewDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Invoice Preview</DialogTitle>
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
          </DialogActions>
        </Dialog>
      </>
    );
  }

  // Desktop Table View
  return (
    <>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell><strong>Employee</strong></TableCell>
              <TableCell><strong>Category</strong></TableCell>
              <TableCell align="right"><strong>Amount (PKR)</strong></TableCell>
              <TableCell><strong>Vendor</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Fraud Score</strong></TableCell>
              <TableCell><strong>Date</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="textSecondary">No pending expenses</Typography>
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((expense) => (
                <TableRow key={expense.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {expense.employeeName}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {expense.employeeEmail}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={expense.expense_category} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {(expense.total_amount || 0).toLocaleString('en-PK')}
                    </Typography>
                  </TableCell>
                  <TableCell>{expense.vendor_name}</TableCell>
                  <TableCell>{getStatusChip(expense.workflow_status)}</TableCell>
                  <TableCell>
                    <Chip label="N/A" size="small" color="default" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(expense.expense_date || expense.create_date).toLocaleDateString('en-PK')}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => loadInvoicePreview(expense.id)}
                      disabled={invoiceLoading}
                      title="View Invoice"
                    >
                      <DescriptionIcon />
                    </IconButton>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => handleAction(expense, 'approve')}
                      sx={{ mr: 1 }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => handleAction(expense, 'reject')}
                    >
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Decision Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {action === 'approve' ? 'Approve Expense' : 'Reject Expense'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, mt: 1 }}>
            <strong>Employee:</strong> {selectedExpense?.employeeName}<br />
            <strong>Amount:</strong> PKR {(selectedExpense?.total_amount || 0).toLocaleString('en-PK')}<br />
            <strong>Category:</strong> {selectedExpense?.expense_category}
          </Typography>

          <TextField
            fullWidth
            label="Remarks (Optional)"
            multiline
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={`Enter ${action === 'approve' ? 'approval' : 'rejection'} remarks...`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={confirmAction}
            variant="contained"
            color={action === 'approve' ? 'success' : 'error'}
            disabled={actionLoading}
          >
            {actionLoading ? <CircularProgress size={20} /> : `Confirm ${action === 'approve' ? 'Approval' : 'Rejection'}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invoice Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Invoice Preview</DialogTitle>
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
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PendingExpensesTable;
