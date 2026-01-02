import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
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
  Divider
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Cancel, ArrowBack, ThumbUp, ThumbDown } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { hrAPI } from '../services/api';

function HRVerificationDetails() {
  const { employeeId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  // Approve/Reject dialogs
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectDetails, setRejectDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadDetails();
  }, [employeeId]);

  const loadDetails = async () => {
  setLoading(true);
  try {
    const response = await hrAPI.getDetails(employeeId);

    console.log('📋 RAW RESPONSE:', response);

    // The response from axios is: { data: { success: true, data: {...} } }
    // So we need response.data.data
    if (response.data && response.data.success) {
      const employeeData = response.data.data;
      console.log('✅ Setting employee data:', employeeData);
      setData(employeeData);
    } else {
      console.error('❌ Invalid response structure:', response);
      toast.error('Invalid response from server');
    }
  } catch (error) {
    console.error('❌ Load details error:', error);
    toast.error(error.response?.data?.message || 'Failed to load details');
  } finally {
    setLoading(false);
  }
};

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await hrAPI.approve(employeeId, approveNotes);
      toast.success('Candidate approved successfully!');
      setApproveDialogOpen(false);
      navigate('/hr/dashboard');
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
      toast.success('Candidate rejected');
      setRejectDialogOpen(false);
      navigate('/hr/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject');
    } finally {
      setSubmitting(false);
    }
  };

  const getVerificationIcon = (status) => {
    if (status === 'passed' || status === 'approved') {
      return <CheckCircle color="success" />;
    }
    if (status === 'failed' || status === 'rejected') {
      return <Cancel color="error" />;
    }
    return <CheckCircle color="disabled" />;
  };

  const getMatchColor = (match) => {
    if (match) return 'success.main';
    return 'error.main';
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 8, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!data || !data.employee) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 8 }}>
          <Alert severity="error">Employee not found</Alert>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/hr/dashboard')}
            sx={{ mt: 2 }}
          >
            Back to Dashboard
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 8, mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/hr/dashboard')}
            sx={{ mr: 2 }}
          >
            Back to Dashboard
          </Button>
          <Typography variant="h4" component="h1">
            Verification Details
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Left Column - Employee Info */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Employee Information
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell><strong>Name:</strong></TableCell>
                        <TableCell>{data.employee?.name || 'N/A'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Personal Email:</strong></TableCell>
                        <TableCell>{data.employee?.personalEmail || 'N/A'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Work Email:</strong></TableCell>
                        <TableCell>{data.employee?.workEmail || 'N/A'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Phone:</strong></TableCell>
                        <TableCell>{data.employee?.phone || 'N/A'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Department:</strong></TableCell>
                        <TableCell>{data.employee?.department || 'N/A'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Position:</strong></TableCell>
                        <TableCell>{data.employee?.position || 'N/A'}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Uploaded Documents
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {!data.documents || data.documents.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No documents uploaded
                  </Typography>
                ) : (
                  data.documents.map((doc) => (
                    <Box key={doc.id} sx={{ mb: 1 }}>
                      <Chip
                        label={doc.name || 'Document'}
                        color="primary"
                        variant="outlined"
                        size="small"
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {doc.type} - {new Date(doc.uploadedAt).toLocaleString()}
                      </Typography>
                    </Box>
                  ))
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Right Column - Verification */}
          <Grid item xs={12} md={6}>
            {/* AI Verification */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {getVerificationIcon(data.aiVerification?.status)}
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    AI Verification
                  </Typography>
                  <Chip
                    label={data.aiVerification?.status?.toUpperCase() || 'PENDING'}
                    color={data.aiVerification?.status === 'passed' ? 'success' : 'warning'}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />

                {data.aiVerification?.score > 0 && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Overall Score: <strong>{data.aiVerification.score}%</strong>
                  </Alert>
                )}

                {/* Data Comparison */}
                {data.aiVerification?.details && Object.keys(data.aiVerification.details).length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableBody>
                        {Object.entries(data.aiVerification.details).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell>
                              <strong>{key.toUpperCase()}:</strong>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color={getMatchColor(value.match)}>
                                {value.match ? '✓ Match' : '✗ Mismatch'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Score: {value.score}%
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    AI verification pending or no details available
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* Side-by-Side Comparison */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Data Comparison
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      {/* Header Row */}
                      <TableRow>
                        <TableCell><strong>Field</strong></TableCell>
                        <TableCell>
                          <Typography variant="subtitle2" color="primary">
                            Entered by Candidate
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="subtitle2" color="secondary">
                            Extracted from CNIC
                          </Typography>
                        </TableCell>
                      </TableRow>

                      {/* Name */}
                      <TableRow>
                        <TableCell><strong>Name:</strong></TableCell>
                        <TableCell>{data.employee?.name || 'N/A'}</TableCell>
                        <TableCell>{data.aiVerification?.extractedData?.name || 'N/A'}</TableCell>
                      </TableRow>

                      {/* CNIC */}
                      <TableRow>
                        <TableCell><strong>CNIC:</strong></TableCell>
                        <TableCell>{data.employee?.cnic || 'N/A'}</TableCell>
                        <TableCell>{data.aiVerification?.extractedData?.cnicNumber || 'N/A'}</TableCell>
                      </TableRow>

                      {/* Father's Name */}
                      <TableRow>
                        <TableCell><strong>Father's Name:</strong></TableCell>
                        <TableCell>{data.employee?.fatherName || 'N/A'}</TableCell>
                        <TableCell>{data.aiVerification?.extractedData?.fatherName || 'N/A'}</TableCell>
                      </TableRow>

                      {/* Date of Birth */}
                      <TableRow>
                        <TableCell><strong>Date of Birth:</strong></TableCell>
                        <TableCell>{data.employee?.dateOfBirth || 'N/A'}</TableCell>
                        <TableCell>{data.aiVerification?.extractedData?.dob || 'N/A'}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* HR Verification Status */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {getVerificationIcon(data.hrVerification?.status)}
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    HR Verification
                  </Typography>
                  <Chip
                    label={data.hrVerification?.status?.toUpperCase() || 'PENDING'}
                    color={data.hrVerification?.status === 'approved' ? 'success' : 'warning'}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />

                {data.hrVerification?.notes && (
                  <Alert severity="info">
                    <strong>Notes:</strong> {data.hrVerification.notes}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Action Buttons */}
        {data.hrVerification?.status === 'pending' && (
          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Review Decision
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<ThumbUp />}
                onClick={() => setApproveDialogOpen(true)}
              >
                Approve Candidate
              </Button>
              <Button
                variant="contained"
                color="error"
                size="large"
                startIcon={<ThumbDown />}
                onClick={() => setRejectDialogOpen(true)}
              >
                Reject Candidate
              </Button>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve Candidate</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Approval Notes (Optional)"
            value={approveNotes}
            onChange={(e) => setApproveNotes(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="e.g., All documents verified. Department and role confirmed."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleApprove}
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={24} /> : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Candidate</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            select
            label="Rejection Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ mt: 2 }}
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
            fullWidth
            multiline
            rows={4}
            label="Additional Details"
            value={rejectDetails}
            onChange={(e) => setRejectDetails(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="Explain the reason for rejection..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleReject}
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={24} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default HRVerificationDetails;
