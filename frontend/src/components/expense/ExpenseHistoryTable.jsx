import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  useMediaQuery,
  CircularProgress
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import { expenseAPI } from '../../services/api';

const categoryOptions = [
  { value: '', label: 'All Categories' },
  { value: 'medical', label: 'Medical' },
  { value: 'petrol', label: 'Petrol' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' }
];

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_manager', label: 'Pending Manager Approval' },
  { value: 'pending_hr', label: 'Pending HR Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'flagged', label: 'Flagged' }
];

const getStatusMeta = (status) => {
  const normalized = (status || '').toLowerCase();

  if (normalized === 'pending_manager' || normalized === 'pending_manager_approval') {
    return { label: 'Pending Manager Approval', color: 'warning' };
  }
  if (normalized === 'pending_hr' || normalized === 'pending_hr_approval') {
    return { label: 'Pending HR Approval', color: 'info' };
  }
  if (normalized === 'approved' || normalized === 'hr_approved') {
    return { label: 'Approved', color: 'success' };
  }
  if (normalized === 'rejected' || normalized === 'manager_rejected') {
    return { label: 'Rejected', color: 'error' };
  }
  if (normalized === 'flagged' || normalized === 'suspicious') {
    return { label: 'Flagged', color: 'warning', tone: 'flagged' };
  }
  if (normalized === 'draft') {
    return { label: 'Draft', color: 'default' };
  }

  return { label: status || 'Unknown', color: 'default' };
};

const formatAmount = (value) => {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return '-';
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(numberValue);
};

const formatDate = (value) => {
  if (!value) return '-';
  const dateOnly = value.split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return dateOnly;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const getPreviewType = (mimetype, name) => {
  const lowerName = (name || '').toLowerCase();
  if (mimetype?.includes('pdf') || lowerName.endsWith('.pdf')) return 'pdf';
  if (mimetype?.startsWith('image/') || lowerName.match(/\.(png|jpg|jpeg|gif|webp)$/i)) return 'image';
  return 'file';
};

const ExpenseHistoryTable = ({ showTitle = true }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const previewUrlsRef = useRef({});

  const [filters, setFilters] = useState({
    status: '',
    category: '',
    dateFrom: '',
    dateTo: '',
    vendor: ''
  });

  const [appliedFilters, setAppliedFilters] = useState({
    status: '',
    category: '',
    dateFrom: '',
    dateTo: '',
    vendor: ''
  });

  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const [expenses, setExpenses] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewMap, setPreviewMap] = useState({});
  const [previewLoading, setPreviewLoading] = useState({});
  const [previewErrors, setPreviewErrors] = useState({});

  const buildParams = (values) => {
    const params = {};
    if (values.status) params.status = values.status;
    if (values.category) params.category = values.category;
    if (values.dateFrom) params.dateFrom = values.dateFrom;
    if (values.dateTo) params.dateTo = values.dateTo;
    if (values.vendor) params.vendor = values.vendor;
    return params;
  };

  const fetchExpenses = async (activeFilters) => {
    setLoading(true);
    setError('');

    try {
      const response = await expenseAPI.list(buildParams(activeFilters));
      const payload = response?.data?.data || response?.data;
      const items = payload?.expenses || [];
      setExpenses(items);
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to load expense history';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses(appliedFilters);
  }, [appliedFilters]);

  useEffect(() => {
    return () => {
      Object.values(previewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

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
        case 'date':
        default:
          return new Date(expense.date || expense.create_date || 0).getTime();
      }
    };

    return [...expenses].sort((a, b) => {
      const aValue = getComparableValue(a);
      const bValue = getComparableValue(b);

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * direction;
      }

      return aValue.localeCompare(bValue) * direction;
    });
  }, [expenses, sortDirection, sortField]);

  const pagedExpenses = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedExpenses.slice(start, start + rowsPerPage);
  }, [page, rowsPerPage, sortedExpenses]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    setPage(0);
  };

  const handleResetFilters = () => {
    const nextFilters = {
      status: '',
      category: '',
      dateFrom: '',
      dateTo: '',
      vendor: ''
    };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(0);
  };

  const handleSortChange = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection('asc');
  };

  const handleSortFieldSelect = (event) => {
    setSortField(event.target.value);
    setPage(0);
  };

  const handleSortDirectionSelect = (event) => {
    setSortDirection(event.target.value);
    setPage(0);
  };

  const handleChangePage = (_, nextPage) => {
    setPage(nextPage);
  };

  const handleChangeRowsPerPage = (event) => {
    const nextValue = Number(event.target.value);
    setRowsPerPage(nextValue);
    setPage(0);
  };

  const loadPreview = async (expenseId) => {
    if (previewMap[expenseId] || previewErrors[expenseId] || previewLoading[expenseId]) {
      return;
    }

    setPreviewLoading((prev) => ({ ...prev, [expenseId]: true }));

    try {
      const response = await expenseAPI.getAttachment(expenseId);
      const blob = response?.data;

      if (!blob || !(blob instanceof Blob) || blob.size === 0) {
        throw new Error('Attachment not available');
      }

      const url = URL.createObjectURL(blob);
      previewUrlsRef.current[expenseId] = url;

      const fileName = response?.headers?.['content-disposition'] || '';
      const type = getPreviewType(blob.type, fileName);

      setPreviewMap((prev) => ({
        ...prev,
        [expenseId]: {
          url,
          type,
          name: fileName
        }
      }));
    } catch (err) {
      const message = err?.response?.status === 404
        ? 'No invoice found for this expense.'
        : 'Failed to load invoice preview.';
      setPreviewErrors((prev) => ({ ...prev, [expenseId]: message }));
    } finally {
      setPreviewLoading((prev) => ({ ...prev, [expenseId]: false }));
    }
  };

  const toggleExpanded = (expenseId) => {
    setExpandedId((prev) => (prev === expenseId ? null : expenseId));
    if (expandedId !== expenseId) {
      loadPreview(expenseId);
    }
  };

  const renderStatusChip = (status) => {
    const meta = getStatusMeta(status);
    if (meta.tone === 'flagged') {
      return (
        <Chip
          label={meta.label}
          size="small"
          sx={{ bgcolor: 'warning.light', color: 'warning.dark', fontWeight: 600 }}
        />
      );
    }

    if (meta.label === 'Draft') {
      return (
        <Chip
          label={meta.label}
          size="small"
          sx={{ bgcolor: 'grey.300', color: 'grey.800', fontWeight: 600 }}
        />
      );
    }

    return <Chip label={meta.label} size="small" color={meta.color} />;
  };

  const renderInvoicePreview = (expense) => {
    const preview = previewMap[expense.id];

    if (previewLoading[expense.id]) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Loading invoice...
          </Typography>
        </Box>
      );
    }

    if (previewErrors[expense.id]) {
      return (
        <Typography variant="body2" color="text.secondary">
          {previewErrors[expense.id]}
        </Typography>
      );
    }

    if (!preview) {
      return (
        <Typography variant="body2" color="text.secondary">
          Load the invoice to see the preview.
        </Typography>
      );
    }

    if (preview.type === 'pdf') {
      return (
        <Box
          component="iframe"
          src={preview.url}
          title="Invoice Preview"
          sx={{ width: '100%', height: 360, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
        />
      );
    }

    if (preview.type === 'image') {
      return (
        <Box
          component="img"
          src={preview.url}
          alt="Invoice Preview"
          sx={{ width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
        />
      );
    }

    return (
      <Button variant="outlined" href={preview.url} target="_blank" rel="noreferrer">
        Open Invoice
      </Button>
    );
  };

  return (
    <Box>
      {showTitle && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" gutterBottom>
            Expense History
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track your submitted expenses and their approval status.
          </Typography>
        </Box>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Filters
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              label="Status"
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
            >
              {statusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              label="Category"
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
            >
              {categoryOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="From"
              name="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={handleFilterChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="To"
              name="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={handleFilterChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Vendor"
              name="vendor"
              value={filters.vendor}
              onChange={handleFilterChange}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              label="Sort By"
              name="sortField"
              value={sortField}
              onChange={handleSortFieldSelect}
            >
              <MenuItem value="date">Date</MenuItem>
              <MenuItem value="category">Category</MenuItem>
              <MenuItem value="amount">Amount</MenuItem>
              <MenuItem value="vendor">Vendor</MenuItem>
              <MenuItem value="status">Status</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              label="Direction"
              name="sortDirection"
              value={sortDirection}
              onChange={handleSortDirectionSelect}
            >
              <MenuItem value="asc">Ascending</MenuItem>
              <MenuItem value="desc">Descending</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={2} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
              <Button variant="outlined" onClick={handleResetFilters}>
                Reset
              </Button>
              <Button variant="contained" onClick={handleApplyFilters}>
                Apply Filters
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : sortedExpenses.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">No expenses found</Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your filters or submit a new request.
          </Typography>
        </Paper>
      ) : isMobile ? (
        <Stack spacing={2}>
          {pagedExpenses.map((expense) => (
            <Card key={expense.id} variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {expense.vendor_name || 'Unknown Vendor'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(expense.date || expense.create_date)}
                    </Typography>
                  </Box>
                  {renderStatusChip(expense.workflow_status)}
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>Category:</strong> {expense.expense_category || '-'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Amount:</strong> {formatAmount(expense.total_amount)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Description:</strong> {expense.description || '-'}
                  </Typography>
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Invoice Preview
                </Typography>
                {!previewMap[expense.id] && !previewLoading[expense.id] && !previewErrors[expense.id] && (
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ mb: 1 }}
                    onClick={() => loadPreview(expense.id)}
                  >
                    Load Invoice
                  </Button>
                )}
                {renderInvoicePreview(expense)}
              </CardContent>
            </Card>
          ))}
          <TablePagination
            component="div"
            count={sortedExpenses.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25]}
          />
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell sortDirection={sortField === 'date' ? sortDirection : false}>
                  <TableSortLabel
                    active={sortField === 'date'}
                    direction={sortField === 'date' ? sortDirection : 'asc'}
                    onClick={() => handleSortChange('date')}
                  >
                    Date
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortField === 'category' ? sortDirection : false}>
                  <TableSortLabel
                    active={sortField === 'category'}
                    direction={sortField === 'category' ? sortDirection : 'asc'}
                    onClick={() => handleSortChange('category')}
                  >
                    Category
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortField === 'amount' ? sortDirection : false}>
                  <TableSortLabel
                    active={sortField === 'amount'}
                    direction={sortField === 'amount' ? sortDirection : 'asc'}
                    onClick={() => handleSortChange('amount')}
                  >
                    Amount
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortField === 'vendor' ? sortDirection : false}>
                  <TableSortLabel
                    active={sortField === 'vendor'}
                    direction={sortField === 'vendor' ? sortDirection : 'asc'}
                    onClick={() => handleSortChange('vendor')}
                  >
                    Vendor
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortField === 'status' ? sortDirection : false}>
                  <TableSortLabel
                    active={sortField === 'status'}
                    direction={sortField === 'status' ? sortDirection : 'asc'}
                    onClick={() => handleSortChange('status')}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedExpenses.map((expense) => (
                <React.Fragment key={expense.id}>
                  <TableRow hover onClick={() => toggleExpanded(expense.id)} sx={{ cursor: 'pointer' }}>
                    <TableCell padding="checkbox">
                      <IconButton
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleExpanded(expense.id);
                        }}
                      >
                        {expandedId === expense.id ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                      </IconButton>
                    </TableCell>
                    <TableCell>{formatDate(expense.date || expense.create_date)}</TableCell>
                    <TableCell>{expense.expense_category || '-'}</TableCell>
                    <TableCell>{formatAmount(expense.total_amount)}</TableCell>
                    <TableCell>{expense.vendor_name || '-'}</TableCell>
                    <TableCell>{renderStatusChip(expense.workflow_status)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                      <Collapse in={expandedId === expense.id} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 3, bgcolor: 'grey.50' }}>
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                              <Typography variant="subtitle2" gutterBottom>
                                Details
                              </Typography>
                              <Stack spacing={1}>
                                <Typography variant="body2">
                                  <strong>Description:</strong> {expense.description || '-'}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Submitted:</strong> {formatDate(expense.create_date)}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Workflow:</strong> {expense.workflow_status || '-'}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Fraud Status:</strong> {expense.fraud_detection_status || 'Not checked'}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Fraud Score:</strong> {expense.fraud_score ?? 'N/A'}
                                </Typography>
                              </Stack>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <Typography variant="subtitle2" gutterBottom>
                                Invoice Preview
                              </Typography>
                              {renderInvoicePreview(expense)}
                            </Grid>
                          </Grid>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={sortedExpenses.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25]}
          />
        </TableContainer>
      )}
    </Box>
  );
};

export default ExpenseHistoryTable;
