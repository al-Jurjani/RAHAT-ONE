import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Alert,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { hrAPI } from '../services/api';

function CNICViewerModal({ open, onClose, documentId, documentName, enteredData }) {
  const [loading, setLoading] = useState(false);
  const [documentUrl, setDocumentUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !documentId) return;

    let objectUrl = null;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setDocumentUrl(null);

    hrAPI.getDocument(documentId)
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setDocumentUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load CNIC document');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, documentId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { height: '85vh' } }}>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">CNIC — {documentName}</Typography>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <>
            {enteredData?.cnic && (
              <Box sx={{ px: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  CNIC number entered by candidate:
                </Typography>
                <Typography variant="h6" fontWeight={600} sx={{ letterSpacing: 1 }}>
                  {enteredData.cnic}
                </Typography>
              </Box>
            )}

            {documentUrl ? (
              <Box sx={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                bgcolor: 'var(--bg-elevated)',
                borderRadius: 1,
                overflow: 'hidden',
              }}>
                <Box
                  component="img"
                  src={documentUrl}
                  alt="CNIC"
                  sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
            ) : (
              <Alert severity="info">No image to display</Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default CNICViewerModal;
