import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Tabs,
  Tab,
} from '@mui/material';
import { CheckCircle, Cancel, ArrowBack } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { hrAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { StatCard, LoadingSpinner } from '../components/ui';
import InitiateOnboardingModal from '../components/InitiateOnboardingModal';

function isVisibleOnboardingEmployee(employee) {
  const name = String(employee?.name || '').trim().toLowerCase();
  return name !== 'administrator';
}

function HRDashboard() {
  const [loading, setLoading] = useState(true);
  const [pendingList, setPendingList] = useState([]);
  const [approvedList, setApprovedList] = useState([]);
  const [autoApprovedList, setAutoApprovedList] = useState([]);
  const [rejectedList, setRejectedList] = useState([]);
  const [currentTab, setCurrentTab] = useState(0);
  const [initiateDialogOpen, setInitiateDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [pendingRes, autoApprovedRes, approvedRes, rejectedRes] = await Promise.all([
        hrAPI.getPending(),
        hrAPI.getAutoApproved(),
        hrAPI.getApproved(),
        hrAPI.getRejected(),
      ]);

      const sanitize = (list) => (Array.isArray(list) ? list.filter(isVisibleOnboardingEmployee) : []);

      setPendingList(sanitize(pendingRes.data.data));
      setAutoApprovedList(sanitize(autoApprovedRes.data.data));
      setApprovedList(sanitize(approvedRes.data.data));
      setRejectedList(sanitize(rejectedRes.data.data));
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      pending:              { label: 'PENDING',              color: 'warning' },
      approved:             { label: 'APPROVED',             color: 'success' },
      rejected:             { label: 'REJECTED',             color: 'error' },
      activated:            { label: 'ACTIVATED',            color: 'success' },
      verification_pending: { label: 'VERIFICATION PENDING', color: 'warning' },
      initiated:            { label: 'INITIATED',            color: 'info' },
      expired:              { label: 'EXPIRED',              color: 'default' },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  const getCurrentList = () => {
    switch (currentTab) {
      case 0: return pendingList;
      case 1: return autoApprovedList;
      case 2: return approvedList;
      case 3: return rejectedList;
      default: return pendingList;
    }
  };

  const currentList = getCurrentList();

  if (loading) {
    return (
      <AppShell pageTitle="HR Verification">
        <LoadingSpinner />
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="HR Verification">
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/hr')}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', padding: 0 }}
          >
            <ArrowBack fontSize="small" /> Back to HR Portal
          </button>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="outlined" size="small" onClick={loadAllData}>
              Refresh
            </Button>
            <Button variant="contained" size="small" onClick={() => setInitiateDialogOpen(true)}>
              Initiate Onboarding
            </Button>
          </div>
        </div>
      </div>

      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <StatCard value={pendingList.length}      label="Pending Verification" />
        <StatCard value={autoApprovedList.length} label="Auto-Approved" />
        <StatCard value={approvedList.length}     label="HR Approved" />
        <StatCard value={rejectedList.length}     label="Rejected" />
      </div>

      {/* Tabs + Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label={`Pending (${pendingList.length})`} />
          <Tab label={`Auto-Approved (${autoApprovedList.length})`} />
          <Tab label={`HR Approved (${approvedList.length})`} />
          <Tab label={`Rejected (${rejectedList.length})`} />
        </Tabs>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email (Work)</TableCell>
                <TableCell>Email (Personal)</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Position</TableCell>
                <TableCell>Status</TableCell>
                {currentTab === 1 ? (
                  <TableCell>CNIC Verified</TableCell>
                ) : (
                  <TableCell>AI Verification</TableCell>
                )}
                {currentTab !== 1 && <TableCell>HR Status</TableCell>}
                <TableCell>{currentTab === 1 ? 'Auto-Approved' : 'Submitted'}</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    {currentTab === 0 && 'No pending verifications'}
                    {currentTab === 1 && 'No auto-approved candidates yet'}
                    {currentTab === 2 && 'No HR-approved candidates yet'}
                    {currentTab === 3 && 'No rejected candidates yet'}
                  </TableCell>
                </TableRow>
              ) : (
                currentList.map((emp) => (
                  <TableRow key={emp.id} hover>
                    <TableCell>{emp.name}</TableCell>
                    <TableCell>{emp.workEmail || 'N/A'}</TableCell>
                    <TableCell>{emp.personalEmail}</TableCell>
                    <TableCell>{emp.department || 'N/A'}</TableCell>
                    <TableCell>{emp.position || 'N/A'}</TableCell>
                    <TableCell>{getStatusChip(emp.onboardingStatus)}</TableCell>
                    {currentTab === 1 ? (
                      <TableCell>
                        {emp.cnicVerified
                          ? <Chip icon={<CheckCircle />} label="VERIFIED"     color="success" size="small" />
                          : <Chip icon={<Cancel />}      label="NOT VERIFIED" color="error"   size="small" />}
                      </TableCell>
                    ) : (
                      <TableCell>
                        {emp.aiVerificationStatus === 'passed' && <Chip icon={<CheckCircle />} label="PASSED"  color="success" size="small" />}
                        {emp.aiVerificationStatus === 'failed' && <Chip icon={<Cancel />}      label="FAILED"  color="error"   size="small" />}
                        {emp.aiVerificationStatus === 'pending' && <Chip label="PENDING" color="warning" size="small" />}
                      </TableCell>
                    )}
                    {currentTab !== 1 && <TableCell>{getStatusChip(emp.hrVerificationStatus)}</TableCell>}
                    <TableCell>
                      {emp.approvedAt
                        ? new Date(emp.approvedAt).toLocaleDateString()
                        : emp.submittedAt
                          ? new Date(emp.submittedAt).toLocaleDateString()
                          : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Button variant="contained" size="small" onClick={() => navigate(`/hr/verification/${emp.id}`)}>
                        {currentTab === 0 ? 'Review' : 'View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      <InitiateOnboardingModal
        open={initiateDialogOpen}
        onClose={() => setInitiateDialogOpen(false)}
        onSuccess={loadAllData}
      />
    </AppShell>
  );
}

export default HRDashboard;
