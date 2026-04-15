import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Box,
  Typography,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  CircularProgress,
  IconButton,
  Alert
} from '@mui/material';
import { Close, CheckCircle, Cancel } from '@mui/icons-material';

function CNICViewerModal({
  open,
  onClose,
  documentId,
  documentName,
  enteredData,
  extractedData,
  verificationDetails
}) {
  const [loading, setLoading] = useState(true);
  const [documentUrl, setDocumentUrl] = useState(null);
  const [error, setError] = useState(null);

  const loadDocument = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `http://localhost:5000/api/hr/verification/document/${documentId}`
      );

      if (!response.ok) {
        throw new Error('Failed to load CNIC document');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setDocumentUrl(url);
    } catch (err) {
      console.error('Failed to load CNIC:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (open && documentId) {
      loadDocument();
    }

    return () => {
      if (documentUrl) {
        URL.revokeObjectURL(documentUrl);
      }
    };
  }, [open, documentId, loadDocument, documentUrl]);

  const renderComparisonRow = (label, enteredValue, extractedValue, matchInfo) => (
    <TableRow>
      <TableCell><strong>{label}</strong></TableCell>
      <TableCell>
        <Typography variant="body2">{enteredValue || 'N/A'}</Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2">{extractedValue || 'N/A'}</Typography>
      </TableCell>
      <TableCell align="center">
        {matchInfo?.match ? (
          <Chip
            icon={<CheckCircle />}
            label={`${matchInfo.score}%`}
            color="success"
            size="small"
          />
        ) : (
          <Chip
            icon={<Cancel />}
            label={`${matchInfo?.score || 0}%`}
            color="error"
            size="small"
          />
        )}
      </TableCell>
    </TableRow>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{ sx: { height: '90vh' } }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">CNIC Verification - {documentName}</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Grid container spacing={3} sx={{ height: '100%' }}>
            {/* Left: CNIC Image */}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  bgcolor: 'var(--bg-elevated)',
                  p: 2,
                  borderRadius: 1
                }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Uploaded CNIC Document
                </Typography>
                <Box
                  component="img"
                  src={documentUrl}
                  alt="CNIC"
                  sx={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    border: '2px solid',
                    borderColor: 'divider',
                    borderRadius: 1
                  }}
                />
              </Box>
            </Grid>

            {/* Right: Data Comparison */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                OCR Extraction vs. Entered Data
              </Typography>

              <Table size="small">
                <TableBody>
                  <TableRow sx={{ bgcolor: 'var(--bg-elevated)' }}>
                    <TableCell><strong>Field</strong></TableCell>
                    <TableCell><strong>Entered by Candidate</strong></TableCell>
                    <TableCell><strong>Extracted from CNIC</strong></TableCell>
                    <TableCell align="center"><strong>Match</strong></TableCell>
                  </TableRow>

                  {renderComparisonRow(
                    'Name',
                    enteredData?.name,
                    extractedData?.name,
                    verificationDetails?.name
                  )}

                  {renderComparisonRow(
                    'CNIC Number',
                    enteredData?.cnic,
                    extractedData?.cnicNumber,
                    verificationDetails?.cnic
                  )}

                  {renderComparisonRow(
                    "Father's Name",
                    enteredData?.fatherName,
                    extractedData?.fatherName,
                    verificationDetails?.fatherName
                  )}

                  {renderComparisonRow(
                    'Date of Birth',
                    enteredData?.dob,
                    extractedData?.dob,
                    verificationDetails?.dob
                  )}
                </TableBody>
              </Table>

              <Box sx={{ mt: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                <Typography variant="body2" color="info.contrastText">
                  <strong>Note:</strong> Green indicates a match, red indicates a mismatch.
                  Review mismatched fields carefully before making a decision.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CNICViewerModal;
