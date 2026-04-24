import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Paper,
  Chip,
  TextField,
  Box,
  CircularProgress,
  Alert,
  Typography,
  Grid,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  FilterList as FilterListIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import DescriptionIcon from '@mui/icons-material/Description';
import axios from 'axios';
import FraudDetailModal from './FraudDetailModal';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const REJECTION_REASON_LABELS = {
  policy_violation: 'Policy Violation',
  fraud_detected: 'Fraud Detected',
  duplicate_claim: 'Duplicate Claim',
  invalid_documents: 'Invalid Documents',
  manager_rejected: 'Manager Rejected',
  hr_rejected: 'HR Rejected',
  other: 'Other'
};

const HUMAN_REJECTION_REASONS = new Set(['manager_rejected', 'hr_rejected']);

const AutoRejectedExpensesTable = ({ refreshTrigger }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [fraudModalOpen, setFraudModalOpen] = useState(false);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterReason, setFilterReason] = useState('');

  useEffect(() => {
    fetchAutoRejected();
  }, [refreshTrigger]);

  const fetchAutoRejected = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_BASE_URL}/expenses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Auto-rejected = rejected by n8n Flow 1 directly (not manager or HR)
      const all = response.data.data.expenses || [];
      const autoRejected = all.filter(
        e => e.workflow_status === 'rejected' &&
             !HUMAN_REJECTION_REASONS.has(e.rejection_reason)
      );
      setExpenses(autoRejected);
      setError('');
    } catch (err) {
      setError('Failed to load auto-rejected expenses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeName = (e) => e.employeeName || e.employee_id?.[1] || 'Unknown';

  const handleViewAttachment = async (expenseId) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/expenses/${expenseId}/attachment`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('No attachment');
      const blob = await response.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      alert('Could not load invoice attachment.');
    }
  };

  const filteredExpenses = useMemo(() => {
    let f = [...expenses];
    if (filterEmployee) {
      const q = filterEmployee.toLowerCase();
      f = f.filter(e => getEmployeeName(e).toLowerCase().includes(q));
    }
    if (filterCategory) {
      f = f.filter(e => e.expense_category === filterCategory);
    }
    if (filterReason) {
      f = f.filter(e => e.rejection_reason === filterReason);
    }
    return f;
  }, [expenses, filterEmployee, filterCategory, filterReason]);

  const sortedExpenses = useMemo(() => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...filteredExpenses].sort((a, b) => {
      let av, bv;
      switch (sortField) {
        case 'amount':  av = Number(a.total_amount || 0); bv = Number(b.total_amount || 0); break;
        case 'category': av = (a.expense_category || '').toLowerCase(); bv = (b.expense_category || '').toLowerCase(); break;
        case 'employee': av = getEmployeeName(a).toLowerCase(); bv = getEmployeeName(b).toLowerCase(); break;
        case 'reason': av = (a.rejection_reason || '').toLowerCase(); bv = (b.rejection_reason || '').toLowerCase(); break;
        default: av = new Date(a.create_date || 0).getTime(); bv = new Date(b.create_date || 0).getTime();
      }
      return typeof av === 'number' ? (av - bv) * dir : av.localeCompare(bv) * dir;
    });
  }, [filteredExpenses, sortField, sortDirection]);

  const pagedExpenses = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedExpenses.slice(start, start + rowsPerPage);
  }, [sortedExpenses, page, rowsPerPage]);

  const handleSortChange = (field) => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const getReasonChip = (reason) => {
    const label = REJECTION_REASON_LABELS[reason] || reason || 'Unknown';
    const color = reason === 'fraud_detected' ? 'error'
                : reason === 'policy_violation' ? 'warning'
                : reason === 'duplicate_claim' ? 'error'
                : reason === 'invalid_documents' ? 'warning'
                : 'default';
    return <Chip label={label} size="small" color={color} variant="outlined" />;
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (expenses.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary" gutterBottom>No Auto-Rejected Expenses</Typography>
        <Typography variant="body2" color="textSecondary">
          Expenses auto-rejected by the AI system (policy violations, fraud, duplicates) will appear here.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ mb: 3, p: 2, bgcolor: 'var(--bg-elevated)', borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          <FilterListIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 18 }} />
          Filters
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth size="small" label="Employee"
              value={filterEmployee}
              onChange={(e) => { setFilterEmployee(e.target.value); setPage(0); }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              select fullWidth size="small" label="Category"
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(0); }}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
            >
              <option value="">All Categories</option>
              <option value="medical">Medical</option>
              <option value="petrol">Petrol</option>
              <option value="travel">Travel</option>
              <option value="other">Other</option>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              select fullWidth size="small" label="Rejection Reason"
              value={filterReason}
              onChange={(e) => { setFilterReason(e.target.value); setPage(0); }}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
            >
              <option value="">All Reasons</option>
              <option value="policy_violation">Policy Violation</option>
              <option value="fraud_detected">Fraud Detected</option>
              <option value="duplicate_claim">Duplicate Claim</option>
              <option value="invalid_documents">Invalid Documents</option>
              <option value="other">Other</option>
            </TextField>
          </Grid>
        </Grid>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'var(--status-danger-bg)' }}>
              <TableCell>
                <TableSortLabel active={sortField === 'employee'} direction={sortField === 'employee' ? sortDirection : 'asc'} onClick={() => handleSortChange('employee')}>
                  <strong>Employee</strong>
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortField === 'category'} direction={sortField === 'category' ? sortDirection : 'asc'} onClick={() => handleSortChange('category')}>
                  <strong>Category</strong>
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel active={sortField === 'amount'} direction={sortField === 'amount' ? sortDirection : 'asc'} onClick={() => handleSortChange('amount')}>
                  <strong>Amount (PKR)</strong>
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortField === 'reason'} direction={sortField === 'reason' ? sortDirection : 'asc'} onClick={() => handleSortChange('reason')}>
                  <strong>Reason</strong>
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortField === 'date'} direction={sortField === 'date' ? sortDirection : 'asc'} onClick={() => handleSortChange('date')}>
                  <strong>Date</strong>
                </TableSortLabel>
              </TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedExpenses.map((expense) => (
              <TableRow key={expense.id} hover sx={{ backgroundColor: 'var(--status-danger-bg)' }}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{getEmployeeName(expense)}</Typography>
                  <Typography variant="caption" color="textSecondary">#{expense.id}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={expense.expense_category || 'N/A'} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {(expense.total_amount || 0).toLocaleString('en-PK')}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title={expense.rejection_details || ''} placement="top">
                    <span>{getReasonChip(expense.rejection_reason)}</span>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {new Date(expense.create_date).toLocaleDateString('en-PK')}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => { setSelectedExpense(expense); setFraudModalOpen(true); }} color="primary" title="View Fraud Analysis">
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleViewAttachment(expense.id)} title="View Invoice">
                    <DescriptionIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={sortedExpenses.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[5, 10, 25]}
      />

      <FraudDetailModal
        open={fraudModalOpen}
        expense={selectedExpense}
        onClose={() => { setFraudModalOpen(false); setSelectedExpense(null); }}
        onActionComplete={fetchAutoRejected}
      />
    </>
  );
};

export default AutoRejectedExpensesTable;
