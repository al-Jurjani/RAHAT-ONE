import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  IconButton,
  Collapse,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  KeyboardArrowDown,
  KeyboardArrowUp,
  GroupAdd as GroupAddIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const EmployeeRow = ({ employee, leaveTypes, onAllocate, onRefresh }) => {
  const [open, setOpen] = useState(false);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAllocations = useCallback(async () => {
    if (!open) return;

    try {
        setLoading(true);
        const token = localStorage.getItem('accessToken');

        console.log(`🔍 Fetching allocations for employee ${employee.id}`);

        // For each leave type, get the balance
        const promises = leaveTypes.map(async (type) => {
        try {
            console.log(`  → Fetching balance for leave type ${type.id} (${type.name})`);

            const response = await axios.get(
            `${API_BASE_URL}/leaves/employee/${employee.id}/balance?leave_type_id=${type.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
            );

            console.log(`  ✅ Balance for ${type.name}:`, response.data);

            // Handle both wrapped and unwrapped responses
            const balanceData = response.data.data || response.data;

            return {
            type: type.name,
            total: balanceData.total || 0,
            used: balanceData.used || 0,
            remaining: balanceData.remaining || 0
            };
        } catch (err) {
            console.error(`  ❌ Error fetching balance for ${type.name}:`, err.response?.data || err.message);
            return {
            type: type.name,
            total: 0,
            used: 0,
            remaining: 0
            };
        }
        });

        const results = await Promise.all(promises);
        console.log(`✅ All allocations for employee ${employee.id}:`, results);

        setAllocations(results);
    } catch (err) {
        console.error('❌ Error fetching allocations:', err);
    } finally {
        setLoading(false);
    }
    }, [open, employee.id, leaveTypes]);

  useEffect(() => {
    if (open) {
      fetchAllocations();
    }
  }, [open, fetchAllocations]);

  return (
    <>
      <TableRow>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>{employee.name}</TableCell>
        <TableCell>{employee.work_email}</TableCell>
        <TableCell>
          {employee.department_id ? employee.department_id[1] : 'N/A'}
        </TableCell>
        <TableCell>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => onAllocate(employee)}
          >
            Allocate Leave
          </Button>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <Typography variant="h6" gutterBottom component="div">
                Current Allocations
              </Typography>
              {loading ? (
                <CircularProgress size={20} />
              ) : allocations.length === 0 ? (
                <Typography color="textSecondary">No allocations found</Typography>
              ) : (
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {allocations.map((alloc, idx) => (
                    <Grid item xs={12} sm={6} md={3} key={idx}>
                      <Paper sx={{ p: 2 }}>
                        <Typography variant="subtitle2" color="primary">
                          {alloc.type}
                        </Typography>
                        <Typography variant="body2">
                          Total: <strong>{alloc.total}</strong> days
                        </Typography>
                        <Typography variant="body2">
                          Used: <strong>{alloc.used}</strong> days
                        </Typography>
                        <Typography variant="body2" color={alloc.remaining > 0 ? 'success.main' : 'error.main'}>
                          Remaining: <strong>{alloc.remaining}</strong> days
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const AllocationManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [allocateLoading, setAllocateLoading] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const [allocationForm, setAllocationForm] = useState({
    leave_type_id: '',
    days: '',
    start_date: '2026-01-01',
    end_date: '2026-12-31'
  });

  const [bulkAllocationForm, setBulkAllocationForm] = useState({
    department_id: 'all',
    leave_type_id: '',
    days: '',
    start_date: '2026-01-01',
    end_date: '2026-12-31'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      console.log('🔍 Fetching employees and leave types...');

      const empResponse = await axios.get(`${API_BASE_URL}/leaves/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const typesResponse = await axios.get(`${API_BASE_URL}/leaves/types`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const deptResponse = await axios.get(`${API_BASE_URL}/lookup/departments`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('✅ Data fetched successfully');

      setEmployees(empResponse.data.data || empResponse.data);
      setLeaveTypes(typesResponse.data);
      setDepartments(deptResponse.data.data || deptResponse.data);
      setError('');
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openAllocationDialog = (employee) => {
    setSelectedEmployee(employee);
    setAllocationForm({
      leave_type_id: '',
      days: '',
      start_date: '2026-01-01',
      end_date: '2026-12-31'
    });
    setDialogOpen(true);
  };

  const handleAllocate = async () => {
    if (!allocationForm.leave_type_id || !allocationForm.days) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setAllocateLoading(true);
      const token = localStorage.getItem('accessToken');

      console.log('📝 Allocating leave...');

      await axios.post(
        `${API_BASE_URL}/leaves/allocate`,
        {
          employee_id: selectedEmployee.id,
          leave_type_id: parseInt(allocationForm.leave_type_id),
          days: parseInt(allocationForm.days),
          start_date: allocationForm.start_date,
          end_date: allocationForm.end_date
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('✅ Leave allocated successfully');

      setDialogOpen(false);
      setError('');
      alert('Leave allocated successfully!');
      fetchData();
    } catch (err) {
      console.error('❌ Allocation failed:', err);
      setError(err.response?.data?.message || 'Failed to allocate leave');
    } finally {
      setAllocateLoading(false);
    }
  };

  const handleBulkAllocate = async () => {
    if (!bulkAllocationForm.leave_type_id || !bulkAllocationForm.days) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setAllocateLoading(true);
      const token = localStorage.getItem('accessToken');

      // Filter employees by department
      const targetEmployees = bulkAllocationForm.department_id === 'all'
        ? employees
        : employees.filter(emp => emp.department_id && emp.department_id[0] === parseInt(bulkAllocationForm.department_id));

      console.log(`📝 Bulk allocating to ${targetEmployees.length} employees...`);

      // Allocate to each employee
      const promises = targetEmployees.map(emp =>
        axios.post(
          `${API_BASE_URL}/leaves/allocate`,
          {
            employee_id: emp.id,
            leave_type_id: parseInt(bulkAllocationForm.leave_type_id),
            days: parseInt(bulkAllocationForm.days),
            start_date: bulkAllocationForm.start_date,
            end_date: bulkAllocationForm.end_date
          },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );

      await Promise.all(promises);

      console.log('✅ Bulk allocation completed');

      setBulkDialogOpen(false);
      setError('');
      alert(`Successfully allocated leave to ${targetEmployees.length} employees!`);
      fetchData();
    } catch (err) {
      console.error('❌ Bulk allocation failed:', err);
      setError(err.response?.data?.message || 'Failed to bulk allocate leave');
    } finally {
      setAllocateLoading(false);
    }
  };

  const filteredEmployees = departmentFilter === 'all'
    ? employees
    : employees.filter(emp => emp.department_id && emp.department_id[0] === parseInt(departmentFilter));

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <CircularProgress />
      </div>
    );
  }

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="body2" color="textSecondary">
          Allocate annual leave balances to employees. Click on an employee row to view existing allocations.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Filter by Department</InputLabel>
            <Select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              label="Filter by Department"
              size="small"
            >
              <MenuItem value="all">All Departments</MenuItem>
              {departments.map((dept) => (
                <MenuItem key={dept.id} value={dept.id}>
                  {dept.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            color="secondary"
            startIcon={<GroupAddIcon />}
            onClick={() => setBulkDialogOpen(true)}
          >
            Bulk Allocate
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={50} />
              <TableCell><strong>Employee Name</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Department</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="textSecondary">No employees found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((employee) => (
                <EmployeeRow
                  key={employee.id}
                  employee={employee}
                  leaveTypes={leaveTypes}
                  onAllocate={openAllocationDialog}
                  onRefresh={fetchData}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Single Allocation Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Allocate Leave for {selectedEmployee?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth required>
              <InputLabel>Leave Type</InputLabel>
              <Select
                value={allocationForm.leave_type_id}
                onChange={(e) => setAllocationForm({ ...allocationForm, leave_type_id: e.target.value })}
                label="Leave Type"
              >
                {leaveTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Number of Days"
              type="number"
              fullWidth
              required
              value={allocationForm.days}
              onChange={(e) => setAllocationForm({ ...allocationForm, days: e.target.value })}
              inputProps={{ min: 1, max: 365 }}
            />

            <TextField
              label="Valid From"
              type="date"
              fullWidth
              value={allocationForm.start_date}
              onChange={(e) => setAllocationForm({ ...allocationForm, start_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="Valid Until"
              type="date"
              fullWidth
              value={allocationForm.end_date}
              onChange={(e) => setAllocationForm({ ...allocationForm, end_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />

            <Alert severity="info">
              The employee will be able to request up to <strong>{allocationForm.days || 0} days</strong> of {
                leaveTypes.find(t => t.id === parseInt(allocationForm.leave_type_id))?.name || 'this leave type'
              }.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={allocateLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleAllocate}
            variant="contained"
            disabled={allocateLoading || !allocationForm.leave_type_id || !allocationForm.days}
          >
            {allocateLoading ? <CircularProgress size={20} /> : 'Allocate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Allocation Dialog */}
      <Dialog open={bulkDialogOpen} onClose={() => setBulkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Bulk Allocate Leave
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Department</InputLabel>
              <Select
                value={bulkAllocationForm.department_id}
                onChange={(e) => setBulkAllocationForm({ ...bulkAllocationForm, department_id: e.target.value })}
                label="Department"
              >
                <MenuItem value="all">All Departments</MenuItem>
                {departments.map((dept) => (
                  <MenuItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Leave Type</InputLabel>
              <Select
                value={bulkAllocationForm.leave_type_id}
                onChange={(e) => setBulkAllocationForm({ ...bulkAllocationForm, leave_type_id: e.target.value })}
                label="Leave Type"
              >
                {leaveTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Number of Days"
              type="number"
              fullWidth
              required
              value={bulkAllocationForm.days}
              onChange={(e) => setBulkAllocationForm({ ...bulkAllocationForm, days: e.target.value })}
              inputProps={{ min: 1, max: 365 }}
            />

            <TextField
              label="Valid From"
              type="date"
              fullWidth
              value={bulkAllocationForm.start_date}
              onChange={(e) => setBulkAllocationForm({ ...bulkAllocationForm, start_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="Valid Until"
              type="date"
              fullWidth
              value={bulkAllocationForm.end_date}
              onChange={(e) => setBulkAllocationForm({ ...bulkAllocationForm, end_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />

            <Alert severity="warning">
              This will allocate <strong>{bulkAllocationForm.days || 0} days</strong> to{' '}
              <strong>
                {bulkAllocationForm.department_id === 'all'
                  ? `all ${employees.length} employees`
                  : `${employees.filter(e => e.department_id && e.department_id[0] === parseInt(bulkAllocationForm.department_id)).length} employees in ${departments.find(d => d.id === parseInt(bulkAllocationForm.department_id))?.name}`
                }
              </strong>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialogOpen(false)} disabled={allocateLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkAllocate}
            variant="contained"
            color="secondary"
            disabled={allocateLoading || !bulkAllocationForm.leave_type_id || !bulkAllocationForm.days}
          >
            {allocateLoading ? <CircularProgress size={20} /> : 'Bulk Allocate'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AllocationManagement;
