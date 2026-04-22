import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import AppShell from '../components/layout/AppShell';
import api from '../services/api';
import { Avatar, Card, LoadingSpinner } from '../components/ui';

function ManagerTeamDirectoryPage() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/attendance/manager/team');
        setTeam(response.data?.data || []);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load team');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = team.filter((emp) =>
    !search.trim() || emp.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  if (loading) {
    return <AppShell pageTitle="My Team"><LoadingSpinner /></AppShell>;
  }

  return (
    <AppShell pageTitle="My Team">
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', color: 'var(--text-primary)' }}>
            My Team
          </h2>
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              minWidth: '220px'
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
          {filtered.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', gridColumn: '1/-1' }}>
              No team members found.
            </div>
          ) : filtered.map((emp) => {
            const shiftName = Array.isArray(emp.shift_id) ? emp.shift_id[1] : null;

            return (
              <Card key={emp.id} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                <Avatar
                  name={emp.name}
                  src={emp.image_128 ? `data:image/png;base64,${emp.image_128}` : null}
                  size="md"
                />

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-base)', marginBottom: 2 }}>
                    {emp.name}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 2 }}>
                    {emp.job_title || '—'}
                  </div>
                  {shiftName && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginBottom: 4 }}>
                      Shift: {shiftName}
                    </div>
                  )}
                  {emp.work_email && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>
                      {emp.work_email}
                    </div>
                  )}
                  {emp.mobile_phone && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: 2 }}>
                      {emp.mobile_phone}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

export default ManagerTeamDirectoryPage;
