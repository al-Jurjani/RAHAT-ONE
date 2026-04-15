import React, { useState, useEffect, useCallback } from 'react';
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
  Alert
} from '@mui/material';
import { Close, Download } from '@mui/icons-material';

function DocumentViewerModal({ open, onClose, documentId, documentName, documentType }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [documentUrl, setDocumentUrl] = useState(null);

  const loadDocument = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `http://localhost:5000/api/hr/verification/document/${documentId}`
      );

      if (!response.ok) {
        throw new Error('Failed to load document');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setDocumentUrl(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (open && documentId) {
      loadDocument();
    }

    // Cleanup: revoke object URL when modal closes
    return () => {
      if (documentUrl) {
        URL.revokeObjectURL(documentUrl);
      }
    };
  }, [open, documentId, loadDocument, documentUrl]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = documentUrl;
    link.download = documentName;
    link.click();
  };

  const isImage = documentType?.startsWith('image/');
  const isPDF = documentType === 'application/pdf';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { height: '90vh' } }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">{documentName}</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {loading && <CircularProgress />}

        {error && (
          <Alert severity="error">{error}</Alert>
        )}

        {!loading && !error && documentUrl && (
          <>
            {isImage && (
              <Box
                component="img"
                src={documentUrl}
                alt={documentName}
                sx={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
                }}
              />
            )}

            {isPDF && (
              <iframe
                src={documentUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none'
                }}
                title={documentName}
              />
            )}

            {!isImage && !isPDF && (
              <Alert severity="info">
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
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DocumentViewerModal;
