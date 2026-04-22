import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import AppShell from '../components/layout/AppShell';
import api from '../services/api';
import { Card, DataTable, FormField, StatCard, StatusChip } from '../components/ui';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'no_record', label: 'Not Checked In' }
];

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatTimeLabel(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Karachi' });
}

function formatHoursLabel(value) {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '—';
  const totalMinutes = Math.round(numeric * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0 && minutes <= 0) return '—';
  if (minutes === 0) return `${hours}h`;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function statusTone(status) {
  if (status === 'present') return 'success';
  if (status === 'late') return 'warning';
  if (status === 'rejected') return 'danger';
  return 'neutral';
}

function ManagerAttendancePage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [statusFilter, setStatusFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/attendance/manager/summary', { params: { date: selectedDate } });
      setRecords(response.data?.data || []);
      setLastUpdated(new Date());
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  useEffect(() => {
    const interval = setInterval(fetchAttendance, 60000);
    return () => clearInterval(interval);
  }, [fetchAttendance]);

  const stats = useMemo(() => ({
    present: records.filter((r) => r.status === 'present').length,
    late: records.filter((r) => r.status === 'late').length,
    rejected: records.filter((r) => r.status === 'rejected').length
  }), [records]);

  const filteredRows = useMemo(() => {
    let rows = records.map((r) => ({
      id: r.id,
      employeeName: r.employeeName || 'Unknown',
      shiftName: r.shiftName || '—',
      checkIn: r.check_in,
      checkOut: r.check_out,
      workedHours: r.worked_hours,
      status: r.status || 'no_record',
      distanceFromBranch: r.distance_from_branch
    }));

    if (statusFilter !== '') rows = rows.filter((r) => r.status === statusFilter);
    if (nameFilter.trim()) {
      const q = nameFilter.trim().toLowerCase();
      rows = rows.filter((r) => r.employeeName.toLowerCase().includes(q));
    }
    return rows;
  }, [records, statusFilter, nameFilter]);

  const columns = [
    { key: 'employeeName', label: 'Employee' },
    { key: 'shiftName', label: 'Shift' },
    { key: 'checkIn', label: 'Check-In', render: (v) => formatTimeLabel(v) },
    { key: 'checkOut', label: 'Check-Out', render: (v) => formatTimeLabel(v) },
    { key: 'workedHours', label: 'Hours', render: (v) => formatHoursLabel(v) },
    {
      key: 'status', label: 'Status',
      render: (v) => <StatusChip status={v} label={v === 'no_record' ? 'No Record' : v} tone={statusTone(v)} />
    },
    {
      key: 'distanceFromBranch', label: 'Distance',
      render: (v) => (v !== null && v !== undefined ? `${Math.round(Number(v))}m` : '—')
    }
  ];

  return (
    <AppShell pageTitle="Team Attendance">
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', color: 'var(--text-primary)' }}>
            Team Attendance
          </h2>
        </div>

        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)', alignItems: 'end' }}>
            <FormField label="Date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            <FormField label="Status" type="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </FormField>
            <FormField label="Employee" type="text" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} placeholder="Search by name..." />
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
          <StatCard value={stats.present} label="Present" />
          <StatCard value={stats.late} label="Late" />
          <StatCard value={stats.rejected} label="Rejected" />
        </div>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Last updated: {lastUpdated ? format(lastUpdated, 'h:mm:ss a') : '—'}
          </div>
          <DataTable columns={columns} data={filteredRows} loading={loading} emptyText="No attendance records for selected filters" />
        </Card>
      </div>
    </AppShell>
  );
}

export default ManagerAttendancePage;
