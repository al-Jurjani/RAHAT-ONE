import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Typography, Tabs, Tab, Box,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip
} from '@mui/material';
import api from '../services/api';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function HRLeaveDashboard() {
  const [tab, setTab] = useState(0);
  const [leaves, setLeaves] = useState({ pending: [], approved: [], rejected: [] });
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [action, setAction] = useState(null);

  useEffect(() => {
    fetchLeaves();
  }, [tab]);

  const fetchLeaves = async () => {
    try {
      const statusMap = { 0: 'confirm', 1: 'validate', 2: 'refuse' };
      const status = statusMap[tab];

      const response = await api.get('/leaves', {
        params: { status }
      });

      const key = tab === 0 ? 'pending' : tab === 1 ? 'approved' : 'rejected';
      setLeaves({ ...leaves, [key]: response.data });
    } catch (error) {
      console.error('Fetch leaves error:', error);
    }
  };

  const handleAction = (leave, actionType) => {
    setSelectedLeave(leave);
    setAction(actionType);
    setOpenDialog(true);
  };

  const confirmAction = async () => {
    try {
      await api.put(`/leaves/${selectedLeave.id}/status`, {
        action,
        remarks
      });

      setOpenDialog(false);
      setRemarks('');
      fetchLeaves();
    } catch (error) {
      console.error('Action error:', error);
    }
  };

  const getStatusColor = (state) => {
    return state === 'confirm' ? 'warning' : state === 'validate' ? 'success' : 'error';
  };

  const renderTable = (data) => (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Employee</TableCell>
            <TableCell>Leave Type</TableCell>
            <TableCell>From</TableCell>
            <TableCell>To</TableCell>
            <TableCell>Days</TableCell>
            <TableCell>Status</TableCell>
            {tab === 0 && <TableCell>Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((leave) => (
            <TableRow key={leave.id}>
              <TableCell>{leave.employee_id[1]}</TableCell>
              <TableCell>{leave.holiday_status_id[1]}</TableCell>
              <TableCell>{leave.request_date_from}</TableCell>
              <TableCell>{leave.request_date_to}</TableCell>
              <TableCell>{leave.number_of_days}</TableCell>
              <TableCell>
                <Chip
                  label={leave.state}
                  color={getStatusColor(leave.state)}
                  size="small"
                />
              </TableCell>
              {tab === 0 && (
                <TableCell>
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    sx={{ mr: 1 }}
                    onClick={() => handleAction(leave, 'approve')}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    onClick={() => handleAction(leave, 'reject')}
                  >
                    Reject
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper elevation={3}>
        <Typography variant="h4" sx={{ p: 3 }}>
          Leave Management Dashboard
        </Typography>

        <Tabs value={tab} onChange={(e, newVal) => setTab(newVal)}>
          <Tab label="Pending" />
          <Tab label="Approved" />
          <Tab label="Rejected" />
        </Tabs>

        <TabPanel value={tab} index={0}>
          {renderTable(leaves.pending)}
        </TabPanel>

        <TabPanel value={tab} index={1}>
          {renderTable(leaves.approved)}
        </TabPanel>

        <TabPanel value={tab} index={2}>
          {renderTable(leaves.rejected)}
        </TabPanel>
      </Paper>

      {/* Approval/Rejection Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>
          {action === 'approve' ? 'Approve' : 'Reject'} Leave Request
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Remarks (optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={confirmAction}
            variant="contained"
            color={action === 'approve' ? 'success' : 'error'}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
