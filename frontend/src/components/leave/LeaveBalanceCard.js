import React, { useState, useEffect } from 'react';
import { CircularProgress, Alert } from '@mui/material';
import axios from 'axios';

const LeaveBalanceCard = ({ refreshTrigger = 0 }) => {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('accessToken');
        const headers = { Authorization: `Bearer ${token}` };

        const { data: types } = await axios.get(
          'http://localhost:5000/api/leaves/types', { headers }
        );

        const results = await Promise.all(
          types.map(async (type) => {
            try {
              const { data } = await axios.get(
                `http://localhost:5000/api/leaves/balance?leave_type_id=${type.id}`,
                { headers }
              );
              return { ...type, balance: data.data || data };
            } catch {
              return { ...type, balance: { total: 0, used: 0, remaining: 0 } };
            }
          })
        );

        if (!cancelled) { setBalances(results); setError(null); }
      } catch {
        if (!cancelled) setError('Failed to load leave balances');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

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
      <p style={heading}>Leave Balances</p>

      {balances.length === 0 ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          No leave types available. Contact HR for allocations.
        </Alert>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {balances.map((item) => {
            const { balance } = item;
            const pct = balance.total > 0
              ? Math.min(100, (balance.used / balance.total) * 100)
              : 0;
            const color = balance.remaining > 5
              ? 'var(--status-success)'
              : balance.remaining > 0
                ? 'var(--status-warning)'
                : 'var(--status-danger)';
            const bgColor = balance.remaining > 5
              ? 'var(--status-success-bg)'
              : balance.remaining > 0
                ? 'var(--status-warning-bg)'
                : 'var(--status-danger-bg)';

            return (
              <div key={item.id} style={{ ...balanceRow, background: bgColor }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color, background: 'var(--bg-surface)', borderRadius: 'var(--radius-full)', padding: '2px 10px', border: `1px solid ${color}` }}>
                    {balance.remaining} left
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  {[['Total', balance.total], ['Used', balance.used], ['Available', balance.remaining]].map(([label, val]) => (
                    <span key={label} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {label}: <strong style={{ color: 'var(--text-primary)' }}>{val}</strong>
                    </span>
                  ))}
                </div>

                {balance.total === 0 && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)', marginBottom: 0 }}>
                    No allocation — contact HR.
                  </p>
                )}
              </div>
            );
          })}
        </div>
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
  margin: '0 0 var(--space-4)',
  fontSize: 'var(--text-lg)',
  fontWeight: 600,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-display)',
};

const balanceRow = {
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-4)',
  border: '1px solid var(--border-subtle)',
};

export default LeaveBalanceCard;
