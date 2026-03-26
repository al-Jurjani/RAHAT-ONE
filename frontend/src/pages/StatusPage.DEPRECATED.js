import React, { useState } from 'react';
import {
  Container,
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  LinearProgress,
  Chip,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import { CheckCircle, Pending, Cancel, HourglassEmpty } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { registrationAPI } from '../services/api';

function StatusPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleCheck = async () => {
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setLoading(true);
    try {
      const response = await registrationAPI.getStatus(email);
      setStatus(response.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch status');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (statusValue) => {
    const colors = {
      initiated: 'warning',
      documents_submitted: 'info',
      verification_pending: 'warning',
      verified: 'success',
      activated: 'success',
      rejected: 'error'
    };
    return colors[statusValue] || 'default';
  };

  const getStatusIcon = (statusValue) => {
    if (statusValue === 'verified' || statusValue === 'activated') {
      return <CheckCircle color="success" />;
    }
    if (statusValue === 'rejected') {
      return <Cancel color="error" />;
    }
    return <HourglassEmpty color="warning" />;
  };

  const getVerificationIcon = (verificationStatus) => {
    if (verificationStatus === 'passed' || verificationStatus === 'approved') {
      return <CheckCircle fontSize="small" color="success" />;
    }
    if (verificationStatus === 'failed' || verificationStatus === 'rejected') {
      return <Cancel fontSize="small" color="error" />;
    }
    return <Pending fontSize="small" color="warning" />;
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          Check Registration Status
        </Typography>
        <Typography variant="subtitle1" align="center" color="text.secondary" paragraph>
          Enter your personal email to check your onboarding status
        </Typography>

        <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                label="Personal Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
                placeholder="your.email@gmail.com"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleCheck}
                disabled={loading}
                size="large"
              >
                {loading ? 'Checking...' : 'Check Status'}
              </Button>
            </Grid>
          </Grid>

          {loading && (
            <Box sx={{ mt: 3 }}>
              <LinearProgress />
            </Box>
          )}

          {status && (
            <Box sx={{ mt: 4 }}>
              {/* Overall Status */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    {getStatusIcon(status.status)}
                    <Typography variant="h5" sx={{ ml: 1 }}>
                      Status: <Chip
                        label={status.status.replace(/_/g, ' ').toUpperCase()}
                        color={getStatusColor(status.status)}
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                  </Box>

                  {/* Progress Bar */}
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Onboarding Progress: {status.progress}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={status.progress}
                    sx={{ height: 10, borderRadius: 5, mb: 2 }}
                  />

                  {/* Work Email */}
                  {status.workEmail && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Your work email: <strong>{status.workEmail}</strong>
                    </Alert>
                  )}

                  {/* Rejection Notice */}
                  {status.rejectionReason && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Registration Rejected
                      </Typography>
                      <Typography variant="body2">
                        <strong>Reason:</strong> {status.rejectionReason.replace(/_/g, ' ')}
                      </Typography>
                      {status.rejectionDetails && (
                        <Typography variant="body2">
                          <strong>Details:</strong> {status.rejectionDetails}
                        </Typography>
                      )}
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Verification Details */}
              <Grid container spacing={2}>
                {/* AI Verification */}
                <Grid item xs={12} sm={6}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        {getVerificationIcon(status.aiVerification.status)}
                        <Typography variant="h6" sx={{ ml: 1 }}>
                          AI Verification
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Status: <Chip
                          label={status.aiVerification.status.toUpperCase()}
                          size="small"
                          color={status.aiVerification.status === 'passed' ? 'success' :
                                 status.aiVerification.status === 'failed' ? 'error' : 'warning'}
                        />
                      </Typography>
                      {status.aiVerification.score > 0 && (
                        <Typography variant="body2" color="text.secondary">
                          Score: {status.aiVerification.score}%
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* HR Verification */}
                <Grid item xs={12} sm={6}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        {getVerificationIcon(status.hrVerification.status)}
                        <Typography variant="h6" sx={{ ml: 1 }}>
                          HR Verification
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Status: <Chip
                          label={status.hrVerification.status.toUpperCase()}
                          size="small"
                          color={status.hrVerification.status === 'approved' ? 'success' :
                                 status.hrVerification.status === 'rejected' ? 'error' : 'warning'}
                        />
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Next Steps */}
              <Card sx={{ mt: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    What's Next?
                  </Typography>
                  {status.status === 'documents_submitted' && (
                    <Typography variant="body2" color="text.secondary">
                      Your documents are being verified by our AI system and HR team.
                      You will receive an email once verification is complete.
                    </Typography>
                  )}
                  {status.status === 'verification_pending' && (
                    <Typography variant="body2" color="text.secondary">
                      AI verification complete. Waiting for HR approval.
                      You should hear back within 1-2 business days.
                    </Typography>
                  )}
                  {status.status === 'verified' && (
                    <Typography variant="body2" color="success.main">
                      ✓ Your registration has been approved!
                      Your work email and system access are being provisioned.
                    </Typography>
                  )}
                  {status.status === 'activated' && (
                    <Typography variant="body2" color="success.main">
                      ✓ You're all set! Check your work email for login credentials.
                    </Typography>
                  )}
                  {status.status === 'rejected' && (
                    <Typography variant="body2" color="error.main">
                      Please contact HR at hr@outfitters.com for more information.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

export default StatusPage;
