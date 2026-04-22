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
  IconButton
} from '@mui/material';
import {
  FilterList as FilterListIcon,
  Visibility as VisibilityIcon,
  Warning as WarningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import DescriptionIcon from '@mui/icons-material/Description';
import axios from 'axios';
import FraudDetailModal from './FraudDetailModal';

const API_BASE_URL = 'http://localhost:5000/api';

const FlaggedExpensesTable = ({ refreshTrigger, onActionComplete }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [fraudModalOpen, setFraudModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 960);

  // Pagination & Sorting
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState('fraud_status');
  const [sortDirection, setSortDirection] = useState('desc');

  // Filters
  const [filterFraudStatus, setFilterFraudStatus] = useState('');
  const [filterWorkflowStatus, setFilterWorkflowStatus] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 960);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchFlaggedExpenses();
  }, [refreshTrigger]);

  const fetchFlaggedExpenses = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const response = await axios.get(
        `${API_BASE_URL}/expenses`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Filter for flagged expenses (suspicious or fraudulent)
      const flaggedExpenses = (response.data.data.expenses || []).filter(
        expense => expense.fraud_detection_status === 'suspicious' ||
                  expense.fraud_detection_status === 'fraudulent'
      );

      setExpenses(flaggedExpenses);
      setError('');
    } catch (err) {
      setError('Failed to load flagged expenses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeName = (expense) => (
    expense.employeeName || expense.employee_id?.[1] || 'Unknown'
  );

  const getEmployeeEmail = (expense) => (
    expense.employeeEmail || expense.employee_email || 'N/A'
  );

  const handleViewAttachment = async (expenseId) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/expenses/${expenseId}/attachment`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to load attachment');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Failed to open attachment:', err);
      alert('Could not load invoice attachment.');
    }
  };

  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses];

    if (filterFraudStatus) {
      filtered = filtered.filter(e => e.fraud_detection_status === filterFraudStatus);
    }

    if (filterWorkflowStatus) {
      filtered = filtered.filter(e => e.workflow_status === filterWorkflowStatus);
    }

    if (filterEmployee) {
      const lowerQuery = filterEmployee.toLowerCase();
      filtered = filtered.filter(e =>
        getEmployeeName(e).toLowerCase().includes(lowerQuery)
      );
    }

    return filtered;
  }, [expenses, filterFraudStatus, filterWorkflowStatus, filterEmployee]);

  const sortedExpenses = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;

    const getComparableValue = (expense) => {
      switch (sortField) {
        case 'amount':
          return Number(expense.total_amount || 0);
        case 'category':
          return (expense.expense_category || '').toLowerCase();
        case 'status':
          return (expense.workflow_status || '').toLowerCase();
        case 'fraud_status':
          return (expense.fraud_detection_status || '').toLowerCase();
        case 'employee':
          return getEmployeeName(expense).toLowerCase();
        case 'date':
        default:
          return new Date(expense.create_date || 0).getTime();
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

  const getWorkflowStatusChip = (status) => {
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

  const getFraudStatusChip = (fraudStatus) => {
    if (fraudStatus === 'fraudulent') {
      return (
        <Chip
          icon={<ErrorIcon />}
          label="Fraudulent"
          size="small"
          color="error"
        />
      );
    } else if (fraudStatus === 'suspicious') {
      return (
        <Chip
          icon={<WarningIcon />}
          label="Suspicious"
          size="small"
          color="warning"
        />
      );
    }
    return <Chip label="N/A" size="small" color="default" variant="outlined" />;
  };

  const handleViewFraudAnalysis = (expense) => {
    setSelectedExpense(expense);
    setFraudModalOpen(true);
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
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary" gutterBottom>
          âœ… No Flagged Expenses
        </Typography>
        <Typography variant="body2" color="textSecondary">
          All expenses have passed fraud detection checks.
        </Typography>
      </Box>
    );
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
            select
            fullWidth
            size="small"
            label="Fraud Status"
            value={filterFraudStatus}
            onChange={(e) => {
              setFilterFraudStatus(e.target.value);
              setPage(0);
            }}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 1 }}
          >
            <option value="">All Fraud Statuses</option>
            <option value="fraudulent">Fraudulent</option>
            <option value="suspicious">Suspicious</option>
          </TextField>
          <TextField
            select
            fullWidth
            size="small"
            label="Workflow Status"
            value={filterWorkflowStatus}
            onChange={(e) => {
              setFilterWorkflowStatus(e.target.value);
              setPage(0);
            }}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
          >
            <option value="">All Statuses</option>
            <option value="pending_manager">Pending Manager</option>
            <option value="pending_hr">Pending HR</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </TextField>
        </Box>

        <Grid container spacing={2}>
          {pagedExpenses.map((expense) => (
            <Grid item xs={12} key={expense.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                      <Typography variant="h6">{getEmployeeName(expense)}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        ID: #{expense.id}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" color="primary">
                        PKR {(expense.total_amount || 0).toLocaleString('en-PK')}
                      </Typography>
                      {getWorkflowStatusChip(expense.workflow_status)}
                    </Box>
                  </Box>

                  <Box sx={{ my: 1 }}>
                    {getFraudStatusChip(expense.fraud_detection_status)}
                    <Chip label={expense.expense_category} size="small" sx={{ ml: 1 }} />
                  </Box>

                  <Typography variant="body2" color="textSecondary">
                    <strong>Date:</strong> {new Date(expense.create_date).toLocaleDateString('en-PK')}
                  </Typography>

                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid var(--border-subtle)' }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={() => handleViewFraudAnalysis(expense)}
                    >
                      View Fraud Analysis
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
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

        {/* Fraud Detail Modal */}
        <FraudDetailModal
          open={fraudModalOpen}
          expense={selectedExpense}
          onClose={() => {
            setFraudModalOpen(false);
            setSelectedExpense(null);
          }}
          onActionComplete={() => {
            fetchFlaggedExpenses();
            if (onActionComplete) onActionComplete();
          }}
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
              select
              fullWidth
              size="small"
              label="Fraud Status"
              value={filterFraudStatus}
              onChange={(e) => {
                setFilterFraudStatus(e.target.value);
                setPage(0);
              }}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
            >
              <option value="">All Fraud Statuses</option>
              <option value="fraudulent">Fraudulent</option>
              <option value="suspicious">Suspicious</option>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Workflow Status"
              value={filterWorkflowStatus}
              onChange={(e) => {
                setFilterWorkflowStatus(e.target.value);
                setPage(0);
              }}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
            >
              <option value="">All Statuses</option>
              <option value="pending_manager">Pending Manager</option>
              <option value="pending_hr">Pending HR</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </TextField>
          </Grid>
        </Grid>
      </Box>

      <TableContainer component={Paper}>
                  <strong>Employee</strong>
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'fraud_status'}
                  direction={sortField === 'fraud_status' ? sortDirection : 'asc'}
                  onClick={() => handleSortChange('fraud_status')}
                >
                  <strong>Fraud Status</strong>
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
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
                  active={sortField === 'status'}
                  direction={sortField === 'status' ? sortDirection : 'asc'}
                  onClick={() => handleSortChange('status')}
                >
                  <strong>Workflow Status</strong>
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
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedExpenses.map((expense) => (
              <TableRow
                key={expense.id}
                hover
                sx={{
                  backgroundColor: expense.fraud_detection_status === 'fraudulent'
                    ? 'var(--status-danger-bg)'
                    : 'var(--status-warning-bg)'
                }}
              >
                <TableCell>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {getEmployeeName(expense)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {getEmployeeEmail(expense)}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  {getFraudStatusChip(expense.fraud_detection_status)}
                </TableCell>
                <TableCell>
                  <Chip label={expense.expense_category} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {(expense.total_amount || 0).toLocaleString('en-PK')}
                  </Typography>
                </TableCell>
                <TableCell>{getWorkflowStatusChip(expense.workflow_status)}</TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {new Date(expense.create_date).toLocaleDateString('en-PK')}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={() => handleViewFraudAnalysis(expense)}
                    color="primary"
                    title="View Fraud Analysis"
                  >
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleViewAttachment(expense.id)}
                    title="View Invoice"
                  >
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
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25]}
      />

      {/* Fraud Detail Modal */}
      <FraudDetailModal
        open={fraudModalOpen}
        expense={selectedExpense}
        onClose={() => {
          setFraudModalOpen(false);
          setSelectedExpense(null);
        }}
        onActionComplete={() => {
          fetchFlaggedExpenses();
          if (onActionComplete) onActionComplete();
        }}
      />
    </>
  );
};

export default FlaggedExpensesTable;
