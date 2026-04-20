import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AppShell from '../components/layout/AppShell';
import { Button, Card, LoadingSpinner, StatusChip } from '../components/ui';
import { hrDashboardAPI } from '../services/api';

function HRMainPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ recentActivity: [] });

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const summaryRes = await hrDashboardAPI.getSummary();
        setSummary(summaryRes.data?.data || { recentActivity: [] });
      } catch (error) {
        console.error('Failed to load HR dashboard summary:', error);
        toast.error('Failed to load HR dashboard summary');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <AppShell pageTitle="HR Home">
        <LoadingSpinner />
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="HR Home">
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <Card
          header="Recent System Activity"
          headerRight={(
            <Button size="sm" variant="secondary" onClick={() => navigate('/hr/audit-log')}>
              View Audit Log
            </Button>
          )}
        >
          {summary.recentActivity?.length ? (
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              {summary.recentActivity.map((item, idx) => (
                <div key={`${item.type}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                      [{item.type}] {item.title}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>{item.subtitle}</div>
                  </div>
                  <StatusChip status={item.status || 'pending'} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No activity to show yet.</div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

export default HRMainPage;
