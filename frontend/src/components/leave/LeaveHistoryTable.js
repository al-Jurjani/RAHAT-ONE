import React, { useState, useEffect } from 'react';
import { CircularProgress, Alert } from '@mui/material';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const STATUS_MAP = {
  confirm:   { label: 'Pending',    color: 'var(--status-warning)',  bg: 'var(--status-warning-bg)'  },
  validate1: { label: 'Pending HR', color: 'var(--status-info)',     bg: 'var(--status-info-bg)'     },
  validate:  { label: 'Approved',   color: 'var(--status-success)',  bg: 'var(--status-success-bg)'  },
  refuse:    { label: 'Rejected',   color: 'var(--status-danger)',   bg: 'var(--status-danger-bg)'   },
  draft:     { label: 'Draft',      color: 'var(--text-muted)',      bg: 'var(--bg-elevated)'        },
};

const FILTERS = [
  { label: 'All',      value: 'all'      },
  { label: 'Pending',  value: 'confirm'  },
  { label: 'Approved', value: 'validate' },
  { label: 'Rejected', value: 'refuse'   },
];

const fmt = (d) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const StatusChip = ({ state }) => {
  const s = STATUS_MAP[state] || STATUS_MAP.draft;
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      color: s.color,
      background: s.bg,
      borderRadius: 'var(--radius-full)',
      padding: '3px 10px',
    }}>
      {s.label}
    </span>
  );
};

const LeaveHistoryTable = ({ refreshTrigger = 0 }) => {
  const [leaves, setLeaves]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [filter, setFilter]     = useState('all');

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('accessToken');
        const { data } = await axios.get(`${API_BASE_URL}/leaves/my-leaves`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) { setLeaves(data); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load leave history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  const visible = filter === 'all' ? leaves : leaves.filter((l) => l.state === filter);

  if (loading) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <CircularProgress size={28} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={card}>
        <Alert severity="error">{error}</Alert>
      </div>
    );
  }

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <p style={heading}>Leave History</p>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                padding: '4px 14px',
                borderRadius: 'var(--radius-full)',
                border: filter === f.value ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                background: filter === f.value ? 'var(--accent-subtle)' : 'transparent',
                color: filter === f.value ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontSize: 'var(--text-xs)',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <Alert severity="info">No leave requests found.</Alert>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                {['Leave Type', 'From', 'To', 'Days', 'Status', 'Remarks', 'Submitted'].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((leave) => (
                <tr key={leave.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={td}>{leave.holiday_status_id[1]}</td>
                  <td style={td}>{fmt(leave.request_date_from)}</td>
                  <td style={td}>{fmt(leave.request_date_to)}</td>
                  <td style={{ ...td, fontWeight: 600, textAlign: 'center' }}>{leave.number_of_days}</td>
                  <td style={td}><StatusChip state={leave.state} /></td>
                  <td style={{ ...td, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {leave.name || '—'}
                  </td>
                  <td style={{ ...td, color: 'var(--text-muted)' }}>{fmt(leave.create_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visible.length > 0 && (
        <p style={{ marginTop: 'var(--space-3)', marginBottom: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {visible.length} record{visible.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

const card = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-6)',
};

const heading = {
  margin: 0,
  fontSize: 'var(--text-lg)',
  fontWeight: 600,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-display)',
};

const th = {
  padding: 'var(--space-2) var(--space-3)',
  textAlign: 'left',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};

const td = {
  padding: 'var(--space-3)',
  fontSize: 'var(--text-sm)',
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
};

export default LeaveHistoryTable;
