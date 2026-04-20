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
  LinearProgress,
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

  const getScoreColor = (score) => {
    if (score >= 0.70) return 'error';
    if (score >= 0.40) return 'warning';
    return 'success';
  };

  const layerWeights = fraudDetails?.weights || {
    md5: 0.35,
    pHash: 0.20,
    clip: 0.25,
    florence: 0.10,
    anomaly: 0.10
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

  const formatFlagLabel = (flag) => {
    if (flag === null || flag === undefined) return '';
    if (typeof flag === 'string' || typeof flag === 'number' || typeof flag === 'boolean') {
      return String(flag);
    }
    if (typeof flag === 'object') {
      const text = flag.text || 'value';
      const region = flag.region || 'numeric';
      const deviation = Number(flag.deviation);
      if (Number.isFinite(deviation)) {
        return `${region}: ${text} (${deviation.toFixed(2)}σ)`;
      }
      return `${region}: ${text}`;
    }
    return String(flag);
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
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">Fraud Score:</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={(expense.fraud_score || 0) * 100}
                  color={getScoreColor(expense.fraud_score)}
                  sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {((expense.fraud_score || 0) * 100).toFixed(1)}%
                </Typography>
              </Box>
            </Grid>
            {fraudDetails && (
              <>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">Confidence:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {((fraudDetails.confidence || 0) * 100).toFixed(1)}%
                  </Typography>
                </Grid>
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

        {/* 5-Layer Analysis */}
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          Detailed Layer Analysis
        </Typography>

        {/* Helper to render a score bar */}
        {(() => {
          const layers = fraudDetails?.layers || {};

          const renderLayer = (title, weight, layerData, extraContent) => {
            // Handle both old format (string) and new format (object)
            const isLegacyString = typeof layerData === 'string';
            const score = isLegacyString ? null : (layerData?.score ?? null);
            const details = isLegacyString
              ? layerData
              : (layerData?.details || (fraudDetails ? 'No data available' : 'Not fetched â€” re-submit expense to generate analysis'));
            const detailsText = toDisplayText(details);
            const skipped = details?.includes('Skipped') || details?.includes('unavailable');
            const hasError = layerData?.error;
            return (
              <Paper key={title} sx={{ p: 2, mb: 2, borderLeft: `4px solid ${score === null || skipped ? '#9e9e9e' : score >= 0.7 ? '#d32f2f' : score >= 0.4 ? '#ed6c02' : '#2e7d32'}` }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {title} ({weight}% weight)
                  </Typography>
                  {score !== null && !skipped ? (
                    <Chip
                      label={`Score: ${(score * 100).toFixed(0)}%`}
                      size="small"
                      color={score >= 0.7 ? 'error' : score >= 0.4 ? 'warning' : 'success'}
                    />
                  ) : (
                    <Chip label={skipped ? 'Skipped' : hasError ? 'Error' : 'N/A'} size="small" color="default" variant="outlined" />
                  )}
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

          // Layer 4: Local text consistency
          const florenceExtra = (() => {
            const analysis = expenseData.florence_analysis || layers.florence?.details || layers.florence?.analysis;
            const flags = layers.florence?.flagged_regions || layers.florence?.flags || [];
            const fontScore = layers.florence?.font_consistency_score;
            const meanStroke = layers.florence?.mean_stroke_width;
            const meanConfidence = layers.florence?.mean_ocr_confidence;
            const numericCount = layers.florence?.numeric_region_count;
            return (
              <Box>
                {fontScore !== undefined && (
                  <Box sx={{ mb: 1, p: 1, bgcolor: '#f3f6ff', borderRadius: 1, border: '1px solid #c5d4ff' }}>
                    <Typography variant="caption" sx={{ display: 'block', color: '#1a237e' }}>
                      Font consistency: {(Number(fontScore) * 100).toFixed(1)}%
                    </Typography>
                    {meanStroke !== undefined && (
                      <Typography variant="caption" sx={{ display: 'block', color: '#1a237e' }}>
                        Mean stroke width: {Number(meanStroke).toFixed(2)}
                      </Typography>
                    )}
                    {meanConfidence !== undefined && (
                      <Typography variant="caption" sx={{ display: 'block', color: '#1a237e' }}>
                        OCR confidence: {Number(meanConfidence).toFixed(1)}%
                      </Typography>
                    )}
                    {numericCount !== undefined && (
                      <Typography variant="caption" sx={{ display: 'block', color: '#1a237e' }}>
                        Numeric regions analyzed: {numericCount}
                      </Typography>
                    )}
                  </Box>
                )}
                {flags && flags.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" sx={{ display: 'block', color: '#616161', mb: 0.5 }}>
                      Flagged regions:
                    </Typography>
                    {flags.map((flag, idx) => {
                      const label = typeof flag === 'object'
                        ? `${flag.region || 'numeric'}: ${flag.text || 'value'}${flag.deviation !== undefined ? ` (${Number(flag.deviation).toFixed(2)}σ)` : ''}`
                        : String(flag);
                      return (
                        <Typography key={`${label}-${idx}`} variant="caption" sx={{ display: 'block', color: '#757575' }}>
                          • {label}
                        </Typography>
                      );
                    })}
                  </Box>
                )}
                {analysis && analysis !== 'null' && analysis !== 'false' ? (
                  <Box sx={{ p: 1.5, bgcolor: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#e65100', display: 'block', mb: 0.5 }}>
                      Layer reasoning:
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#424242', whiteSpace: 'pre-wrap' }}>
                      {toDisplayText(analysis)}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="caption" sx={{ color: '#9e9e9e' }}>
                    {layers.florence?.error ? 'ML service was unavailable' : 'No analysis stored (skipped or not yet run)'}
                  </Typography>
                )}
              </Box>
            );
          })();

          // Layer 5: Anomaly
          const anomalyExtra = (
            <Box>
              {layers.anomaly?.zScore !== null && layers.anomaly?.zScore !== undefined && (
                <Typography variant="caption" sx={{ display: 'block', color: '#616161' }}>
                  Z-score: {layers.anomaly.zScore?.toFixed(2)} {layers.anomaly.isAnomaly ? 'âš ï¸ Statistical anomaly' : 'âœ“ Within normal range'}
                </Typography>
              )}
              {expenseData.anomaly_confidence !== null && expenseData.anomaly_confidence !== undefined && (
                <Typography variant="caption" sx={{ display: 'block', color: '#616161', mt: 0.5 }}>
                  Anomaly confidence: {(expenseData.anomaly_confidence * 100).toFixed(1)}%
                </Typography>
              )}
            </Box>
          );

          return (
            <>
              {renderLayer('Layer 1: MD5 Hash', Math.round((layerWeights.md5 || 0) * 100), layers.md5, md5Extra)}
              {renderLayer('Layer 2: Perceptual Hash (pHash)', Math.round((layerWeights.pHash || 0) * 100), layers.pHash, phashExtra)}
              {renderLayer('Layer 3: CLIP Visual Similarity', Math.round((layerWeights.clip || 0) * 100), layers.clip, clipExtra)}
              {renderLayer('Layer 4: Local Text Consistency', Math.round((layerWeights.florence || 0) * 100), layers.florence, florenceExtra)}
              {renderLayer('Layer 5: Anomaly Detection', Math.round((layerWeights.anomaly || 0) * 100), layers.anomaly, anomalyExtra)}
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
