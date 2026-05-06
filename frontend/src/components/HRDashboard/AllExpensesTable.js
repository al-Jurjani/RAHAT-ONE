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
  Button,
  Chip,
  TextField,
  Box,
  CircularProgress,
  Alert,
  Typography,
  Card,
  CardContent,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import DescriptionIcon from '@mui/icons-material/Description';
import VisibilityIcon from '@mui/icons-material/Visibility';
import axios from 'axios';
import { expenseAPI } from '../../services/api';
import FraudDetailModal from './FraudDetailModal';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const sanitizeEmployeeName = (value) => {
  const name = String(value || '').trim();
  const lowered = name.toLowerCase();
  if (!name || lowered === 'n/a' || lowered === 'na' || lowered === 'unknown') return '';
  return name;
};

const getPreviewType = (mimetype, name) => {
  const lowerName = (name || '').toLowerCase();
  if (mimetype?.includes('pdf') || lowerName.endsWith('.pdf')) return 'pdf';
  if (mimetype?.startsWith('image/') || lowerName.match(/\.(png|jpg|jpeg|gif|webp)$/i)) return 'image';
  return 'file';
};

const AllExpensesTable = ({ refreshTrigger, onActionComplete }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [fraudModalOpen, setFraudModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 960);

  // Pagination & Sorting
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [expandedExpenseId, setExpandedExpenseId] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 960);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchAllExpenses();
  }, [refreshTrigger]);

  const fetchAllExpenses = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const response = await axios.get(
        `${API_BASE_URL}/expenses`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setExpenses(response.data.data.expenses || []);
      setError('');
    } catch (err) {
      setError('Failed to load expenses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeName = (expense) => sanitizeEmployeeName(expense.employeeName || expense.employee_id?.[1]);

  const getEmployeeSubtitle = (expense) => {
    const dept = expense.employeeDepartment;
    const job = expense.employeeJob;
    if (dept && job) return `${dept} · ${job}`;
    if (dept) return dept;
    if (job) return job;
    return expense.employeeEmail || expense.employee_email || null;
  };

  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses];

    if (filterStatus) {
      filtered = filtered.filter(e => e.workflow_status === filterStatus);
    }

    if (filterCategory) {
      filtered = filtered.filter(e =>
        e.expense_category?.toLowerCase().includes(filterCategory.toLowerCase())
      );
    }

    if (filterEmployee) {
      const lowerQuery = filterEmployee.toLowerCase();
      filtered = filtered.filter(e =>
        getEmployeeName(e).toLowerCase().includes(lowerQuery)
      );
    }

    return filtered;
  }, [expenses, filterStatus, filterCategory, filterEmployee]);

  const sortedExpenses = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;

    const getComparableValue = (expense) => {
      switch (sortField) {
        case 'amount':
          return Number(expense.total_amount || 0);
        case 'category':
          return (expense.expense_category || '').toLowerCase();
        case 'vendor':
          return (expense.vendor_name || '').toLowerCase();
        case 'status':
          return (expense.workflow_status || '').toLowerCase();
        case 'employee':
          return getEmployeeName(expense).toLowerCase();
        case 'date':
        default:
          return new Date(expense.expense_date || expense.create_date || 0).getTime();
      }
    };

    return [...filteredExpenses].sort((a, b) => {
      const aValue = getComparableValue(a);
      const bValue = getComparableValue(b);

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * direction;
      }
      return aValue.localeCompare(bValue) * direction;
    });
  }, [filteredExpenses, sortField, sortDirection]);

  const pagedExpenses = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedExpenses.slice(start, start + rowsPerPage);
  }, [page, rowsPerPage, sortedExpenses]);

  const handleSortChange = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
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

  // Mobile Card View
  if (isMobile) {
    return (
      <>
        {/* Filters */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'var(--bg-elevated)', borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            <FilterListIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 18 }} />
            Filters
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Employee"
            value={filterEmployee}
            onChange={(e) => {
              setFilterEmployee(e.target.value);
              setPage(0);
            }}
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Category"
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setPage(0);
            }}
            sx={{ mb: 1 }}
          />
          <TextField
            select
            fullWidth
            size="small"
            label="Status"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(0);
            }}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_manager">Pending Manager</option>
            <option value="pending_hr">Pending HR</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </TextField>
        </Box>

        <Grid container spacing={2}>
          {pagedExpenses.length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="info">No expenses found</Alert>
            </Grid>
          ) : (
            pagedExpenses.map((expense) => (
              <Grid item xs={12} key={expense.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box>
                        <Typography variant="h6">{getEmployeeName(expense)}</Typography>
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
                    </Box>

                    <Typography variant="body2" color="textSecondary">
                      <strong>Date:</strong> {new Date(expense.expense_date || expense.create_date).toLocaleDateString('en-PK')}
                    </Typography>

                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid var(--border-subtle)' }}>
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
                          >
                            {invoiceLoading ? <CircularProgress size={16} /> : 'View Invoice'}
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>

        <TablePagination
          component="div"
          count={sortedExpenses.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </>
    );
  }

  // Desktop Table View
  return (
    <>
      {/* Filters */}
      <Box sx={{ mb: 3, p: 2, bgcolor: 'var(--bg-elevated)', borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          <FilterListIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 18 }} />
          Filters
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Employee"
              value={filterEmployee}
              onChange={(e) => {
                setFilterEmployee(e.target.value);
                setPage(0);
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Category"
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setPage(0);
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Status"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(0);
              }}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_manager">Pending Manager</option>
              <option value="pending_hr">Pending HR</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </TextField>
          </Grid>
        </Grid>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'var(--bg-elevated)' }}>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'employee'}
                  direction={sortField === 'employee' ? sortDirection : 'asc'}
                  onClick={() => handleSortChange('employee')}
                >
                  <strong>Employee</strong>
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'category'}
                  direction={sortField === 'category' ? sortDirection : 'asc'}
                  onClick={() => handleSortChange('category')}
                >
                  <strong>Category</strong>
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortField === 'amount'}
                  direction={sortField === 'amount' ? sortDirection : 'asc'}
                  onClick={() => handleSortChange('amount')}
                >
                  <strong>Amount (PKR)</strong>
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'vendor'}
                  direction={sortField === 'vendor' ? sortDirection : 'asc'}
                  onClick={() => handleSortChange('vendor')}
                >
                  <strong>Vendor</strong>
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'status'}
                  direction={sortField === 'status' ? sortDirection : 'asc'}
                  onClick={() => handleSortChange('status')}
                >
                  <strong>Status</strong>
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'date'}
                  direction={sortField === 'date' ? sortDirection : 'asc'}
                  onClick={() => handleSortChange('date')}
                >
                  <strong>Date</strong>
                </TableSortLabel>
              </TableCell>
              <TableCell align="center"><strong>Invoice</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="textSecondary">No expenses found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              pagedExpenses.map((expense) => (
                <TableRow key={expense.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {getEmployeeName(expense)}
                      </Typography>
                      {getEmployeeSubtitle(expense) && (
                        <Typography variant="caption" color="textSecondary">
                          {getEmployeeSubtitle(expense)}
                        </Typography>
                      )}
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
                    <Typography variant="body2">
                      {new Date(expense.expense_date || expense.create_date).toLocaleDateString('en-PK')}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => { setSelectedExpense(expense); setFraudModalOpen(true); }}
                      color="primary"
                      title="View Fraud Analysis"
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => loadInvoicePreview(expense.id)}
                      disabled={invoiceLoading}
                      title="View Invoice"
                    >
                      <DescriptionIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={sortedExpenses.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25]}
      />

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

      <FraudDetailModal
        open={fraudModalOpen}
        expense={selectedExpense}
        onClose={() => { setFraudModalOpen(false); setSelectedExpense(null); }}
        onActionComplete={() => { setFraudModalOpen(false); setSelectedExpense(null); fetchAllExpenses(); if (onActionComplete) onActionComplete(); }}
      />
    </>
  );
};

export default AllExpensesTable;
