import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Divider,
  Chip
} from '@mui/material';
import {
  SmartToy as BotIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import axios from 'axios';

const BOT_KEYWORDS = ['rpa bot', 'rahat rpa', 'auto-approved', 'auto-refused', 'auto-rejected', 'policy bot'];

const isBot = (author, body) => {
  const text = ((author || '') + ' ' + (body || '')).toLowerCase();
  return BOT_KEYWORDS.some(kw => text.includes(kw));
};

const LeaveMessagesDialog = ({ leaveId, open, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');

      const response = await axios.get(
        `http://localhost:5000/api/leaves/${leaveId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessages(response.data || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setError('Failed to load decision log.');
    } finally {
      setLoading(false);
    }
  }, [leaveId]);

  useEffect(() => {
    if (open && leaveId) {
      fetchMessages();
    }
  }, [open, leaveId, fetchMessages]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // Strip HTML tags from Odoo message bodies
  const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Decision Log — Leave #{leaveId}</DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {!loading && !error && messages.length === 0 && (
          <Typography color="textSecondary" sx={{ py: 2 }}>
            No log entries yet. The RPA bot notes will appear here after the flow runs.
          </Typography>
        )}

        {!loading && messages.map((msg, idx) => {
          const author = msg.author_id ? msg.author_id[1] : 'System';
          const body = stripHtml(msg.body);
          const bot = isBot(author, body);

          return (
            <Box key={idx}>
              {idx > 0 && <Divider sx={{ my: 1 }} />}
              <Box sx={{ py: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  {bot
                    ? <BotIcon fontSize="small" color="primary" />
                    : <PersonIcon fontSize="small" color="action" />
                  }
                  <Typography variant="subtitle2">
                    {author}
                  </Typography>
                  {bot && (
                    <Chip label="RPA Bot" size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                  )}
                  <Typography variant="caption" color="textSecondary" sx={{ ml: 'auto' }}>
                    {formatDate(msg.date)}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ pl: 3.5, whiteSpace: 'pre-wrap' }}>
                  {body || '(no content)'}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default LeaveMessagesDialog;
