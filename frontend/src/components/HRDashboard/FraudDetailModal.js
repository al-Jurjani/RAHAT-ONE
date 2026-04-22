import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Paper,
  Chip,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableRow,
  CircularProgress
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_BASE_URL = 'http://localhost:5000/api';

const FraudDetailModal = ({ open, expense, onClose, onActionComplete }) => {
  const [actionLoading, setActionLoading] = useState(false);
  const [showFullClipEmbedding, setShowFullClipEmbedding] = useState(false);
  // Full expense details (includes clip_embedding, florence_analysis â€” fetched separately due to size)
  const [fullExpense, setFullExpense] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (open && expense?.id) {
      setFullExpense(null);
      setShowFullClipEmbedding(false);
      setLoadingDetails(true);
      const token = localStorage.getItem('accessToken');
      axios.get(`${API_BASE_URL}/expenses/${expense.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => setFullExpense(res.data.data || res.data))
        .catch(err => console.error('Failed to fetch full expense details:', err))
        .finally(() => setLoadingDetails(false));
    }
  }, [open, expense?.id]);

  if (!expense) return null;

  // Use fullExpense for detailed fields (clip_embedding, florence_analysis), fall back to expense
  const expenseData = fullExpense || expense;

  // Parse fraud_detection_details
  let fraudDetails = null;
  try {
    const detailsSource = expenseData.fraud_detection_details || expense.fraud_detection_details;
    if (detailsSource) {
      fraudDetails = typeof detailsSource === 'string'
        ? JSON.parse(detailsSource)
        : detailsSource;
    }
  } catch (err) {
    console.error('Failed to parse fraud details:', err);
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'fraudulent':
        return <ErrorIcon sx={{ fontSize: 40, color: '#d32f2f' }} />;
      case 'suspicious':
        return <WarningIcon sx={{ fontSize: 40, color: '#ed6c02' }} />;
      case 'clean':
        return <CheckCircleIcon sx={{ fontSize: 40, color: '#2e7d32' }} />;
      default:
        return <InfoIcon sx={{ fontSize: 40, color: '#0288d1' }} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'fraudulent':
        return '#d32f2f';
      case 'suspicious':
        return '#ed6c02';
      case 'clean':
        return '#2e7d32';
      default:
        return '#757575';
    }
  };

  const handleHRDecision = async (decision) => {
    if (!expense.approval_token) {
      toast.error('No approval token found for this expense');
      return;
    }

    try {
      setActionLoading(true);

      await axios.post(
        `${API_BASE_URL}/expenses/${expense.id}/hr-decision`,
        {
          token: expense.approval_token,
          decision,
          remarks: decision === 'approve'
            ? 'HR reviewed fraud analysis and approved'
            : 'HR reviewed fraud analysis and rejected due to fraud concerns'
        }
      );

      toast.success(
        decision === 'approve'
          ? 'Expense approved successfully'
          : 'Expense rejected successfully'
      );

      if (onActionComplete) onActionComplete();
      onClose();
    } catch (err) {
      console.error('HR decision error:', err);
      toast.error(err.response?.data?.error || 'Failed to process decision');
    } finally {
      setActionLoading(false);
    }
  };

  const canApproveReject = expense.workflow_status === 'pending_hr';

  const toDisplayText = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {getStatusIcon(expense.fraud_detection_status)}
          <Box>
            <Typography variant="h6">
              Fraud Analysis - Expense #{expense.id}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {expense.employee_id?.[1] || 'Unknown Employee'}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loadingDetails && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'text.secondary' }}>
            <CircularProgress size={16} />
            <Typography variant="caption">Loading full analysis details...</Typography>
          </Box>
        )}
        {/* Overall Summary */}
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'var(--bg-elevated)' }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            Overall Assessment
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">Status:</Typography>
              <Chip
                label={expense.fraud_detection_status?.toUpperCase() || 'N/A'}
                size="small"
                sx={{
                  mt: 0.5,
                  bgcolor: getStatusColor(expense.fraud_detection_status),
                  color: 'white',
                  fontWeight: 600
                }}
              />
            </Grid>
            {fraudDetails && (
              <>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">Processing Time:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {(
                      fraudDetails.processingTime
                      || ((fraudDetails.processing_time_seconds || 0) * 1000)
                      || 0
                    ).toLocaleString()}ms
                  </Typography>
                </Grid>
              </>
            )}
          </Grid>

          {fraudDetails && fraudDetails.recommendation && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <strong>Recommendation:</strong> {fraudDetails.recommendation}
            </Alert>
          )}
        </Paper>

        {/* Layer Analysis */}
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          Detailed Fraud Layer Analysis
        </Typography>

        {(() => {
          const layers = fraudDetails?.layers || {};

          const renderLayer = (title, layerData, extraContent) => {
            // Handle both old format (string) and new format (object)
            const isLegacyString = typeof layerData === 'string';
            const details = isLegacyString
              ? layerData
              : (layerData?.details || (fraudDetails ? 'No data available' : 'Not fetched â€” re-submit expense to generate analysis'));
            const detailsText = toDisplayText(details);
            const skipped = details?.includes('Skipped') || details?.includes('unavailable');
            const hasError = layerData?.error;
            const layerStatus = hasError
              ? 'Error'
              : skipped
                ? 'Skipped'
                : layerData?.validation_passed === true
                  ? 'Passed'
                  : layerData?.validation_passed === false
                    ? 'Failed'
                    : layerData?.matched
                      ? 'Matched'
                      : 'Reviewed';
            return (
              <Paper key={title} sx={{ p: 2, mb: 2, borderLeft: '4px solid #9e9e9e' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {title}
                  </Typography>
                  <Chip label={layerStatus} size="small" color={hasError ? 'error' : skipped ? 'default' : 'primary'} variant={hasError || skipped ? 'outlined' : 'filled'} />
                </Box>
                <Typography variant="body2" color={hasError ? 'error' : 'textSecondary'} sx={{ mb: extraContent ? 1 : 0 }}>
                  {detailsText}
                </Typography>
                {extraContent}
              </Paper>
            );
          };

          // Layer 1: MD5
          const md5Extra = expenseData.document_hash && (
            <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', color: '#616161', wordBreak: 'break-all' }}>
              MD5: {expenseData.document_hash}
              {layers.md5?.matchedExpenseId && ` â†’ duplicate of Expense #${layers.md5.matchedExpenseId}`}
            </Typography>
          );

          // Layer 2: pHash
          const phashExtra = (
            <Box>
              {layers.pHash?.similarity !== undefined && (
                <Typography variant="caption" sx={{ display: 'block', color: '#616161' }}>
                  Max similarity to past invoices: {(layers.pHash.similarity * 100).toFixed(1)}%
                </Typography>
              )}
              {layers.pHash?.amountDeltaRatio !== undefined && layers.pHash?.amountDeltaRatio !== null && (
                <Typography variant="caption" sx={{ display: 'block', color: '#616161' }}>
                  Amount delta vs closest match: {(Number(layers.pHash.amountDeltaRatio) * 100).toFixed(1)}%
                </Typography>
              )}
              {layers.pHash?.templatePattern && (
                <Typography variant="caption" sx={{ display: 'block', color: '#e65100', mt: 0.5 }}>
                  Repeated template pattern detected across multiple historical receipts
                </Typography>
              )}
              {expenseData.perceptual_hash && (
                <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', color: '#616161', wordBreak: 'break-all', mt: 0.5 }}>
                  pHash: {expenseData.perceptual_hash}
                </Typography>
              )}
            </Box>
          );

          // Layer 3: CLIP
          const clipExtra = (() => {
            const similarity = layers.clip?.similarity;
            let embeddingEl = null;
            if (expenseData.clip_embedding && expenseData.clip_embedding !== 'false') {
              try {
                const emb = typeof expenseData.clip_embedding === 'string'
                  ? JSON.parse(expenseData.clip_embedding)
                  : expenseData.clip_embedding;
                if (Array.isArray(emb) && emb.length > 0) {
                  const preview = emb.slice(0, 5).map(v => v.toFixed(4)).join(', ');
                  const rest = emb.slice(5).map(v => v.toFixed(4)).join(', ');
                  embeddingEl = (
                    <Box sx={{ mt: 1, p: 1.5, bgcolor: 'var(--bg-elevated)', borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#616161', wordBreak: 'break-all' }}>
                        <strong>512-dim Embedding (first 5):</strong> [{preview}
                        {!showFullClipEmbedding ? '...' : `, ${rest}`}]
                      </Typography>
                      <Button size="small" onClick={() => setShowFullClipEmbedding(!showFullClipEmbedding)} sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
                        {showFullClipEmbedding ? 'Collapse' : `Show all 512 values`}
                      </Button>
                    </Box>
                  );
                }
              } catch (e) {}
            }
            return (
              <Box>
                {similarity !== undefined && (
                  <Typography variant="caption" sx={{ display: 'block', color: '#616161', mb: 0.5 }}>
                    Max visual similarity to past invoices: {(similarity * 100).toFixed(1)}%
                  </Typography>
                )}
                {layers.clip?.amountDeltaRatio !== undefined && layers.clip?.amountDeltaRatio !== null && (
                  <Typography variant="caption" sx={{ display: 'block', color: '#616161', mb: 0.5 }}>
                    Amount delta vs closest visual match: {(Number(layers.clip.amountDeltaRatio) * 100).toFixed(1)}%
                  </Typography>
                )}
                {layers.clip?.templatePattern && (
                  <Typography variant="caption" sx={{ display: 'block', color: '#e65100', mb: 0.5 }}>
                    Repeated visual template pattern detected
                  </Typography>
                )}
                {embeddingEl || (
                  <Typography variant="caption" sx={{ color: '#9e9e9e' }}>
                    {layers.clip?.error ? 'ML service was unavailable' : 'No embedding stored (skipped or not yet run)'}
                  </Typography>
                )}
              </Box>
            );
          })();

          // Layer 2 (new): Receipt OCR + deterministic validation
          const receiptMathLayer = layers.receiptMath || layers.florence || {};
          const receiptMathExtra = (() => {
            const analysis = receiptMathLayer?.analysis || expenseData.florence_analysis || receiptMathLayer?.details;
            const claimedAmount = receiptMathLayer?.claimed_amount ?? receiptMathLayer?.structured_receipt?.claimed_amount;
            const detectedTotal = receiptMathLayer?.detected_total_amount ?? receiptMathLayer?.structured_receipt?.detected_total_amount;
            const deltaRatio = receiptMathLayer?.amount_delta_ratio ?? receiptMathLayer?.structured_receipt?.amount_delta_ratio;
            const validationPassed = receiptMathLayer?.validation_passed;
            const validationErrors = Array.isArray(receiptMathLayer?.validation_errors)
              ? receiptMathLayer.validation_errors
              : [];
            return (
              <Box>
                {validationPassed !== undefined && (
                  <Typography variant="caption" sx={{ display: 'block', color: validationPassed ? '#2e7d32' : '#d32f2f', mb: 0.5 }}>
                    Deterministic validation: {validationPassed ? 'Passed' : 'Failed'}
                  </Typography>
                )}
                {claimedAmount !== undefined && claimedAmount !== null && (
                  <Typography variant="caption" sx={{ display: 'block', color: '#616161' }}>
                    Claimed amount: {Number(claimedAmount).toFixed(2)}
                  </Typography>
                )}
                {detectedTotal !== undefined && detectedTotal !== null && (
                  <Typography variant="caption" sx={{ display: 'block', color: '#616161' }}>
                    OCR detected total: {Number(detectedTotal).toFixed(2)}
                  </Typography>
                )}
                {deltaRatio !== undefined && deltaRatio !== null && (
                  <Typography variant="caption" sx={{ display: 'block', color: '#616161', mb: 0.5 }}>
                    Amount delta ratio: {(Number(deltaRatio) * 100).toFixed(1)}%
                  </Typography>
                )}
                {validationErrors.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" sx={{ display: 'block', color: '#616161', mb: 0.5 }}>
                      Validation errors:
                    </Typography>
                    {validationErrors.map((err, idx) => (
                      <Typography key={`${idx}-${err.code || 'validation'}`} variant="caption" sx={{ display: 'block', color: '#c62828' }}>
                        • {err.message || toDisplayText(err)}
                      </Typography>
                    ))}
                  </Box>
                )}
                {analysis && analysis !== 'null' && analysis !== 'false' ? (
                  <Box sx={{ p: 1.5, bgcolor: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#e65100', display: 'block', mb: 0.5 }}>
                      Chandra OCR / validation notes:
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#424242', whiteSpace: 'pre-wrap' }}>
                      {toDisplayText(analysis)}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="caption" sx={{ color: '#9e9e9e' }}>
                    {receiptMathLayer?.error ? 'ML service was unavailable' : 'No analysis stored (skipped or not yet run)'}
                  </Typography>
                )}
              </Box>
            );
          })();

          // Layer 5: Anomaly
          const anomalyExtra = (
            <Box>
              <Typography variant="caption" sx={{ display: 'block', color: '#616161' }}>
                {layers.anomaly?.isAnomaly ? 'Statistical anomaly detected' : 'Within normal range'}
              </Typography>
              {layers.anomaly?.details && (
                <Typography variant="caption" sx={{ display: 'block', color: '#757575', mt: 0.5 }}>
                  {toDisplayText(layers.anomaly.details)}
                </Typography>
              )}
            </Box>
          );

          const hasNewModel = Boolean(layers.receiptMath);

          if (hasNewModel) {
            return (
              <>
                {renderLayer('Layer 1: MD5 Hash (Global Duplicate Check)', layers.md5, md5Extra)}
                {renderLayer('Layer 2: Chandra OCR + Pydantic Validation', layers.receiptMath, receiptMathExtra)}
                {renderLayer('Layer 3: Statistical Category Anomaly', layers.anomaly, anomalyExtra)}
              </>
            );
          }

          return (
            <>
              {renderLayer('Layer 1: MD5 Hash', layers.md5, md5Extra)}
              {renderLayer('Layer 2: Perceptual Hash (pHash)', layers.pHash, phashExtra)}
              {renderLayer('Layer 3: CLIP Visual Similarity', layers.clip, clipExtra)}
              {renderLayer('Layer 4: Local Text Consistency', layers.florence, receiptMathExtra)}
              {renderLayer('Layer 5: Anomaly Detection', layers.anomaly, anomalyExtra)}
            </>
          );
        })()}

        <Divider sx={{ my: 3 }} />

        {/* Expense Details */}
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          Expense Details
        </Typography>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Expense ID:</TableCell>
              <TableCell>{expense.id}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Employee:</TableCell>
              <TableCell>{expense.employee_id?.[1] || 'Unknown'}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Amount:</TableCell>
              <TableCell>PKR {(expense.total_amount || 0).toLocaleString('en-PK')}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Category:</TableCell>
              <TableCell>{expense.expense_category}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Vendor:</TableCell>
              <TableCell>{expense.vendor_name}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Date:</TableCell>
              <TableCell>{new Date(expense.expense_date || expense.create_date).toLocaleDateString('en-PK')}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Description:</TableCell>
              <TableCell>{expense.description}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Workflow Status:</TableCell>
              <TableCell>
                <Chip label={expense.workflow_status} size="small" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {canApproveReject ? (
          <>
            <Button
              onClick={() => handleHRDecision('reject')}
              color="error"
              variant="outlined"
              disabled={actionLoading}
              startIcon={actionLoading ? <CircularProgress size={16} /> : <ThumbDownIcon />}
            >
              Reject
            </Button>
            <Button
              onClick={() => handleHRDecision('approve')}
              color="success"
              variant="contained"
              disabled={actionLoading}
              startIcon={actionLoading ? <CircularProgress size={16} /> : <ThumbUpIcon />}
            >
              Approve
            </Button>
          </>
        ) : (
          <Alert severity="info" sx={{ flex: 1, mr: 2 }}>
            This expense is in <strong>{expense.workflow_status}</strong> status and cannot be approved/rejected from here.
          </Alert>
        )}
        <Button onClick={onClose} disabled={actionLoading}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FraudDetailModal;
