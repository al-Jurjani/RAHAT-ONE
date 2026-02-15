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
import DocumentViewerModal from '../components/DocumentViewerModal';
import CNICViewerModal from '../components/CNICViewerModal';

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

  // Document viewer modals
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [cnicViewerOpen, setCnicViewerOpen] = useState(false);
  const [cnicDocument, setCnicDocument] = useState(null);

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

      console.log('🔍 HR Assigned Fields:', {
        hrAssignedDepartment: employeeData.employee?.hrAssignedDepartment,
        hrAssignedDepartmentId: employeeData.employee?.hrAssignedDepartmentId,
        hrAssignedPosition: employeeData.employee?.hrAssignedPosition,
        hrAssignedPositionId: employeeData.employee?.hrAssignedPositionId,
        department: employeeData.employee?.department,
        departmentId: employeeData.employee?.departmentId,
        position: employeeData.employee?.position,
        positionId: employeeData.employee?.positionId
      });

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
      console.log("approve employee ID:", employeeId);
      console.log('👉 Approving candidate with notes:', approveNotes);
      await hrAPI.approve(employeeId, approveNotes);
      toast.success('Candidate approved successfully!');
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
      toast.success('Candidate rejected');
      setRejectDialogOpen(false);
      navigate('/hr/verification');
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
            onClick={() => navigate('/hr/verification')}
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
          onClick={() => navigate('/hr/verification')}
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
                          if (isCNIC) {
                            setCnicDocument(doc);
                            setCnicViewerOpen(true);
                          } else {
                            setSelectedDocument(doc);
                            setViewerOpen(true);
                          }
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
                  <strong>Notes:</strong> {data.hrVerification?.notes}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 🆕 ASSIGNMENT VERIFICATION - FULL WIDTH BELOW COLUMNS */}
      {(data.employee?.hrAssignedDepartment || data.employee?.hrAssignedPosition) && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Assignment Verification
              </Typography>
              {(() => {
                const deptMatch = !data.employee?.hrAssignedDepartment ||
                                 (data.employee.hrAssignedDepartmentId === data.employee.departmentId);
                const posMatch = !data.employee?.hrAssignedPosition ||
                                (data.employee.hrAssignedPositionId === data.employee.positionId);
                const allMatch = deptMatch && posMatch;

                return (
                  <Chip
                    icon={allMatch ? <CheckCircle /> : <Cancel />}
                    label={allMatch ? 'All Match' : 'Mismatch Detected'}
                    color={allMatch ? 'success' : 'error'}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                );
              })()}
            </Box>
            <Divider sx={{ mb: 2 }} />

            <TableContainer>
              <Table size="small">
                <TableBody>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell width="20%"><strong>Field</strong></TableCell>
                    <TableCell width="30%">
                      <Typography variant="subtitle2" color="primary">
                        HR Assigned
                      </Typography>
                    </TableCell>
                    <TableCell width="30%">
                      <Typography variant="subtitle2" color="secondary">
                        Candidate Selected
                      </Typography>
                    </TableCell>
                    <TableCell width="20%" align="center"><strong>Status</strong></TableCell>
                  </TableRow>

                  {data.employee?.hrAssignedDepartment && (
                    <TableRow
                      sx={{
                        bgcolor: data.employee.hrAssignedDepartmentId === data.employee.departmentId
                          ? 'rgba(76, 175, 80, 0.08)'
                          : 'rgba(244, 67, 54, 0.08)'
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          Department
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="primary.main" fontWeight="medium">
                          {data.employee.hrAssignedDepartment}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {data.employee.hrAssignedDepartmentId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={
                            data.employee.hrAssignedDepartmentId === data.employee.departmentId
                              ? 'success.main'
                              : 'error.main'
                          }
                          fontWeight="medium"
                        >
                          {data.employee.department || 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {data.employee.departmentId || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {data.employee.hrAssignedDepartmentId === data.employee.departmentId ? (
                          <Chip
                            icon={<CheckCircle />}
                            label="Match"
                            color="success"
                            size="small"
                          />
                        ) : (
                          <Chip
                            icon={<Cancel />}
                            label="Mismatch"
                            color="error"
                            size="small"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )}

                  {data.employee?.hrAssignedPosition && (
                    <TableRow
                      sx={{
                        bgcolor: data.employee.hrAssignedPositionId === data.employee.positionId
                          ? 'rgba(76, 175, 80, 0.08)'
                          : 'rgba(244, 67, 54, 0.08)'
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          Position
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="primary.main" fontWeight="medium">
                          {data.employee.hrAssignedPosition}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {data.employee.hrAssignedPositionId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={
                            data.employee.hrAssignedPositionId === data.employee.positionId
                              ? 'success.main'
                              : 'error.main'
                          }
                          fontWeight="medium"
                        >
                          {data.employee.position || 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {data.employee.positionId || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {data.employee.hrAssignedPositionId === data.employee.positionId ? (
                          <Chip
                            icon={<CheckCircle />}
                            label="Match"
                            color="success"
                            size="small"
                          />
                        ) : (
                          <Chip
                            icon={<Cancel />}
                            label="Mismatch"
                            color="error"
                            size="small"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {(data.employee.hrAssignedDepartmentId !== data.employee.departmentId ||
              data.employee.hrAssignedPositionId !== data.employee.positionId) && (
              <>
                <Box sx={{ mt: 2 }}>
                  <Alert severity="warning">
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      ⚠️ Assignment Mismatch Detected
                    </Typography>
                    <Typography variant="body2">
                      The candidate selected a different {
                        data.employee.hrAssignedDepartmentId !== data.employee.departmentId &&
                        data.employee.hrAssignedPositionId !== data.employee.positionId
                          ? 'department and position'
                          : data.employee.hrAssignedDepartmentId !== data.employee.departmentId
                            ? 'department'
                            : 'position'
                      } than what was initially assigned by HR.
                    </Typography>
                  </Alert>
                </Box>

                {data.hrVerification?.status === 'pending' && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.300' }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      🔧 Quick Actions:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        onClick={async () => {
                          try {
                            setSubmitting(true);
                            await hrAPI.overrideAssignment(employeeId, { useHRAssignment: true });
                            toast.success('✅ Assignment updated to HR values');
                            loadDetails();
                          } catch (error) {
                            toast.error('Failed to override assignment');
                            console.error(error);
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                        disabled={submitting}
                      >
                        {submitting ? <CircularProgress size={16} sx={{ mr: 1 }} /> : '✓ '}
                        Use HR Assignment
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="secondary"
                      >
                        Accept Candidate Selection
                      </Button>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      💡 Tip: Use "Use HR Assignment" to force the original values, or proceed with approval to keep candidate's selection.
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

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

    {/* Document Viewer Modal */}
    <DocumentViewerModal
      open={viewerOpen}
      onClose={() => setViewerOpen(false)}
      documentId={selectedDocument?.id}
      documentName={selectedDocument?.name}
      documentType={selectedDocument?.type}
    />

    {/* CNIC Viewer Modal with OCR Comparison */}
    <CNICViewerModal
      open={cnicViewerOpen}
      onClose={() => setCnicViewerOpen(false)}
      documentId={cnicDocument?.id}
      documentName={cnicDocument?.name}
      enteredData={{
        name: data?.employee?.name,
        cnic: data?.employee?.cnic,
        fatherName: data?.employee?.fatherName,
        dob: data?.employee?.dateOfBirth
      }}
      extractedData={data?.aiVerification?.extractedData}
      verificationDetails={data?.aiVerification?.details}
    />
  </Container>
);
}

export default HRVerificationDetails;
