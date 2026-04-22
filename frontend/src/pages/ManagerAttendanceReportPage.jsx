import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import AppShell from '../components/layout/AppShell';
import api from '../services/api';
import { Card, DataTable, LoadingSpinner } from '../components/ui';

function currentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(value) {
  if (!value) return '';
  const [year, month] = value.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function ManagerAttendanceReportPage() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthString());
  const [report, setReport] = useState([]);
  const [daysElapsed, setDaysElapsed] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/attendance/manager/monthly', { params: { month: selectedMonth } });
      const data = response.data?.data || {};
      setReport(data.report || []);
      setDaysElapsed(data.daysElapsed || 0);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load monthly report');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const columns = [
    { key: 'employeeName', label: 'Employee' },
    {
      key: 'daysPresent',
      label: 'Days Present',
      render: (v) => (
        <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>{v}</span>
      )
    },
    {
      key: 'daysLate',
      label: 'Days Late',
      render: (v) => (
        <span style={{ color: v > 0 ? 'var(--status-warning)' : 'var(--text-muted)', fontWeight: v > 0 ? 600 : 400 }}>{v}</span>
      )
    },
    {
      key: 'daysRejected',
      label: 'Check-In Rejections',
      render: (v) => (
        <span style={{ color: v > 0 ? 'var(--status-danger)' : 'var(--text-muted)', fontWeight: v > 0 ? 600 : 400 }}>{v}</span>
      )
    },
    {
      key: 'daysAbsent',
      label: 'Days Absent',
      render: (v) => (
        <span style={{ color: v > 3 ? 'var(--status-danger)' : v > 0 ? 'var(--status-warning)' : 'var(--text-muted)', fontWeight: v > 0 ? 600 : 400 }}>
          {v}
        </span>
      )
    }
  ];

  return (
    <AppShell pageTitle="Monthly Report">
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', color: 'var(--text-primary)' }}>
              Monthly Attendance Report
            </h2>
            {daysElapsed > 0 && (
              <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                {formatMonthLabel(selectedMonth)} · {daysElapsed} days elapsed
              </p>
            )}
          </div>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)'
            }}
          />
        </div>

        {loading ? (
          <Card><LoadingSpinner /></Card>
        ) : report.length === 0 ? (
          <Card>
            <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-6)' }}>
              No attendance records found for {formatMonthLabel(selectedMonth)}.
            </div>
          </Card>
        ) : (
          <Card>
            <DataTable
              columns={columns}
              data={report}
              emptyText="No records"
            />
          </Card>
        )}
      </div>
    </AppShell>
  );
}

export default ManagerAttendanceReportPage;
