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
  IconButton
} from '@mui/material';
import {
  FilterList as FilterListIcon,
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import DescriptionIcon from '@mui/icons-material/Description';
import axios from 'axios';
import FraudDetailModal from './FraudDetailModal';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AutoApprovedExpensesTable = ({ refreshTrigger }) => {
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

  useEffect(() => {
    fetchAutoApproved();
  }, [refreshTrigger]);

  const fetchAutoApproved = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_BASE_URL}/expenses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Auto-approved = approved by n8n Flow 1 directly (not manager or HR)
      const all = response.data.data.expenses || [];
      const autoApproved = all.filter(
        e => e.workflow_status === 'approved' &&
             !e.manager_approved &&
             !e.hr_approved
      );
      setExpenses(autoApproved);
      setError('');
    } catch (err) {
      setError('Failed to load auto-approved expenses');
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
    return f;
  }, [expenses, filterEmployee, filterCategory]);

  const sortedExpenses = useMemo(() => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...filteredExpenses].sort((a, b) => {
      let av, bv;
      switch (sortField) {
        case 'amount':  av = Number(a.total_amount || 0); bv = Number(b.total_amount || 0); break;
        case 'category': av = (a.expense_category || '').toLowerCase(); bv = (b.expense_category || '').toLowerCase(); break;
        case 'employee': av = getEmployeeName(a).toLowerCase(); bv = getEmployeeName(b).toLowerCase(); break;
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

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (expenses.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary" gutterBottom>No Auto-Approved Expenses</Typography>
        <Typography variant="body2" color="textSecondary">
          Expenses auto-approved by the AI system (clean, &le;PKR 10,000, no policy violations) will appear here.
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
        </Grid>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'var(--status-success-bg)' }}>
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
              <TableCell><strong>Status</strong></TableCell>
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
              <TableRow key={expense.id} hover sx={{ backgroundColor: 'var(--status-success-bg)' }}>
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
                  <Chip
                    icon={<CheckCircleIcon />}
                    label="Auto-Approved"
                    size="small"
                    color="success"
                  />
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
        onActionComplete={fetchAutoApproved}
      />
    </>
  );
};

export default AutoApprovedExpensesTable;
