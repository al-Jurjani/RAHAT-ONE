import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Box,
  IconButton,
  Typography,
  Alert,
} from '@mui/material';
import { Close, Download } from '@mui/icons-material';
import { hrAPI } from '../services/api';

function DocumentViewerModal({ open, onClose, documentId, documentName, documentType }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [documentUrl, setDocumentUrl] = useState(null);

  // Load when the modal opens (or documentId changes); revoke URL on cleanup.
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
        if (!cancelled) setError('Failed to load document');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, documentId]); // intentionally excludes documentUrl to prevent loop

  const handleDownload = () => {
    if (!documentUrl) return;
    const link = document.createElement('a');
    link.href = documentUrl;
    link.download = documentName;
    link.click();
  };

  const isImage = documentType?.startsWith('image/');
  const isPDF   = documentType === 'application/pdf';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { height: '90vh' } }}>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">{documentName}</Typography>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {loading && <CircularProgress />}

        {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}

        {!loading && !error && documentUrl && (
          <>
            {isImage && (
              <Box component="img" src={documentUrl} alt={documentName}
                sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            )}
            {isPDF && (
              <iframe src={documentUrl} style={{ width: '100%', height: '100%', border: 'none' }}
                title={documentName} />
            )}
            {!isImage && !isPDF && (
              <Alert severity="info" sx={{ m: 2 }}>
                Preview not available for this file type. Please download to view.
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleDownload} startIcon={<Download />} disabled={!documentUrl}>
          Download
        </Button>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default DocumentViewerModal;
