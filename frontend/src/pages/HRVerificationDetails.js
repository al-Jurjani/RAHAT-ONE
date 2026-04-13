import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  CircularProgress,
  Alert,
  Divider,
  Typography,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Cancel, ArrowBack, ThumbUp, ThumbDown } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { hrAPI } from '../services/api';
import DocumentViewerModal from '../components/DocumentViewerModal';
import CNICViewerModal from '../components/CNICViewerModal';
import AppShell from '../components/layout/AppShell';
import { LoadingSpinner } from '../components/ui';

function HRVerificationDetails() {
  const { employeeId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectDetails, setRejectDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [cnicViewerOpen, setCnicViewerOpen] = useState(false);
  const [cnicDocument, setCnicDocument] = useState(null);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const response = await hrAPI.getDetails(employeeId);
      if (response.data && response.data.success) {
        setData(response.data.data);
      } else {
        toast.error('Invalid response from server');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await hrAPI.approve(employeeId, approveNotes);
      toast.success('Candidate approved — provisioning in progress. They will receive a welcome email shortly.');
      setApproveDialogOpen(false);
      navigate('/hr/verification');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason) {
      toast.error('Please select a rejection reason');
      return;
    }
    setSubmitting(true);
    try {
      await hrAPI.reject(employeeId, rejectReason, rejectDetails);
      toast.success('Candidate rejected — they will be notified by email.');
      setRejectDialogOpen(false);
      navigate('/hr/verification');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject');
    } finally {
      setSubmitting(false);
    }
  };

  const getVerificationIcon = (status) => {
    if (status === 'passed' || status === 'approved') return <CheckCircle color="success" />;
    if (status === 'failed'  || status === 'rejected') return <Cancel color="error" />;
    return <CheckCircle color="disabled" />;
  };

  if (loading) {
    return (
      <AppShell pageTitle="Verification Details">
        <LoadingSpinner />
      </AppShell>
    );
  }

  if (!data || !data.employee) {
    return (
      <AppShell pageTitle="Verification Details">
        <Alert severity="error">Employee not found</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/hr/verification')} sx={{ mt: 2 }}>
          Back to Dashboard
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Verification Details">
      <Box sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/hr/verification')}>
          Back to Dashboard
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Employee Information</Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    {[
                      ['Name',           data.employee?.name],
                      ['Personal Email', data.employee?.personalEmail],
                      ['Work Email',     data.employee?.workEmail],
                      ['Phone',          data.employee?.phone],
                      ['Department',     data.employee?.department],
                      ['Position',       data.employee?.position],
                    ].map(([label, val]) => (
                      <TableRow key={label}>
                        <TableCell><strong>{label}:</strong></TableCell>
                        <TableCell>{val || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Uploaded Documents</Typography>
              <Divider sx={{ mb: 2 }} />
              {!data.documents || data.documents.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No documents uploaded</Typography>
              ) : (
                data.documents.map((doc) => {
                  const isCNIC = doc.name.toLowerCase().includes('cnic');
                  return (
                    <Box key={doc.id} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={doc.name || 'Document'}
                        color="primary"
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          if (isCNIC) { setCnicDocument(doc); setCnicViewerOpen(true); }
                          else        { setSelectedDocument(doc); setViewerOpen(true); }
                        }}
                        sx={{ cursor: 'pointer' }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {doc.type} - {new Date(doc.uploadedAt).toLocaleString()}
                      </Typography>
                    </Box>
                  );
                })
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {getVerificationIcon(data.aiVerification?.status)}
                <Typography variant="h6" sx={{ ml: 1 }}>CNIC Verification</Typography>
                <Chip
                  label={data.aiVerification?.status === 'passed' ? 'VERIFIED' : data.aiVerification?.status === 'failed' ? 'FAILED' : 'PENDING'}
                  color={data.aiVerification?.status === 'passed' ? 'success' : data.aiVerification?.status === 'failed' ? 'error' : 'warning'}
                  size="small"
                  sx={{ ml: 'auto' }}
                />
              </Box>
              <Divider sx={{ mb: 2 }} />
              {data.aiVerification?.status !== 'pending' ? (
                <>
                  <Alert
                    severity={data.aiVerification?.extractedData?.cnicNumber &&
                      data.aiVerification.extractedData.cnicNumber !== 'N/A' &&
                      data.employee?.cnic &&
                      data.aiVerification.extractedData.cnicNumber.replace(/[\s-]/g, '') === data.employee.cnic.replace(/[\s-]/g, '')
                        ? 'success' : 'error'}
                    sx={{ mb: 2 }}
                  >
                    <strong>CNIC Number:</strong>{' '}
                    {data.aiVerification?.extractedData?.cnicNumber?.replace(/[\s-]/g, '') === data.employee?.cnic?.replace(/[\s-]/g, '')
                      ? 'Matched' : 'Mismatched'}
                  </Alert>
                  {data.aiVerification?.extractedData?.confidence > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      OCR Confidence: {Math.round(data.aiVerification.extractedData.confidence)}%
                    </Typography>
                  )}
                  {data.aiVerification?.verifiedAt && (
                    <Typography variant="caption" color="text.secondary">
                      Verified: {new Date(data.aiVerification.verifiedAt).toLocaleString()}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  CNIC verification pending — awaiting registration completion
                </Typography>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>CNIC Number Comparison</Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell><strong>Entered by Candidate:</strong></TableCell>
                      <TableCell>{data.employee?.cnic || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Extracted from CNIC (OCR):</strong></TableCell>
                      <TableCell>{data.aiVerification?.extractedData?.cnicNumber || 'N/A'}</TableCell>
                    </TableRow>
                    {data.aiVerification?.extractedData?.name && data.aiVerification.extractedData.name !== 'N/A' && (
                      <TableRow>
                        <TableCell><strong>Name from CNIC:</strong></TableCell>
                        <TableCell>{data.aiVerification.extractedData.name}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {data.aiVerification?.extractedData?.rawMatches?.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    All CNIC patterns found in OCR text:
                  </Typography>
                  {data.aiVerification.extractedData.rawMatches.map((m, i) => (
                    <Chip key={i} label={m} size="small" variant="outlined" sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {getVerificationIcon(data.employee?.onboardingStatus === 'activated' ? 'approved' : data.hrVerification?.status)}
                <Typography variant="h6" sx={{ ml: 1 }}>HR Verification</Typography>
                <Chip
                  label={data.employee?.onboardingStatus === 'activated' && data.hrVerification?.status === 'pending' ? 'AUTO-APPROVED' : (data.hrVerification?.status?.toUpperCase() || 'PENDING')}
                  color={data.employee?.onboardingStatus === 'activated' || data.hrVerification?.status === 'approved' ? 'success' : 'warning'}
                  size="small"
                  sx={{ ml: 'auto' }}
                />
              </Box>
              <Divider sx={{ mb: 2 }} />
              {data.employee?.onboardingStatus === 'activated' && data.hrVerification?.status === 'pending' && (
                <Alert severity="success">
                  This employee was auto-approved — all verification checks passed automatically.
                </Alert>
              )}
              {data.hrVerification?.notes && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  <strong>Notes:</strong> {data.hrVerification.notes}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      {data.hrVerification?.status === 'pending' && data.employee?.onboardingStatus !== 'activated' && (
        <Box sx={{ mt: 3, p: 3, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
          <Typography variant="h6" gutterBottom>Review Decision</Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button variant="contained" color="success" size="large" startIcon={<ThumbUp />} onClick={() => setApproveDialogOpen(true)}>
              Approve Candidate
            </Button>
            <Button variant="contained" color="error" size="large" startIcon={<ThumbDown />} onClick={() => setRejectDialogOpen(true)}>
              Reject Candidate
            </Button>
          </Box>
        </Box>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve Candidate</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth multiline rows={4} label="Approval Notes (Optional)"
            value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)}
            sx={{ mt: 2 }} placeholder="e.g., All documents verified. Department and role confirmed."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)} disabled={submitting}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleApprove} disabled={submitting}>
            {submitting ? <CircularProgress size={24} /> : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Candidate</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth select label="Rejection Reason"
            value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} sx={{ mt: 2 }}
          >
            <MenuItem value="cnic_mismatch">CNIC Mismatch</MenuItem>
            <MenuItem value="name_mismatch">Name Mismatch</MenuItem>
            <MenuItem value="dob_mismatch">Date of Birth Mismatch</MenuItem>
            <MenuItem value="invalid_documents">Invalid Documents</MenuItem>
            <MenuItem value="wrong_department">Wrong Department</MenuItem>
            <MenuItem value="duplicate_entry">Duplicate Entry</MenuItem>
            <MenuItem value="failed_background_check">Failed Background Check</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </TextField>
          <TextField
            fullWidth multiline rows={4} label="Additional Details"
            value={rejectDetails} onChange={(e) => setRejectDetails(e.target.value)}
            sx={{ mt: 2 }} placeholder="Explain the reason for rejection..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)} disabled={submitting}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleReject} disabled={submitting}>
            {submitting ? <CircularProgress size={24} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      <DocumentViewerModal
        open={viewerOpen} onClose={() => setViewerOpen(false)}
        documentId={selectedDocument?.id} documentName={selectedDocument?.name} documentType={selectedDocument?.type}
      />
      <CNICViewerModal
        open={cnicViewerOpen} onClose={() => setCnicViewerOpen(false)}
        documentId={cnicDocument?.id} documentName={cnicDocument?.name}
        enteredData={{ cnic: data?.employee?.cnic }}
        extractedData={data?.aiVerification?.extractedData}
        verificationDetails={data?.aiVerification?.details}
      />
    </AppShell>
  );
}

export default HRVerificationDetails;
