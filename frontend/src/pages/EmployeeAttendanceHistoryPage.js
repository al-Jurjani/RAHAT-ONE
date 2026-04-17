import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import AppShell from '../components/layout/AppShell';
import api from '../services/api';
import { Button, Card, StatCard, StatusChip } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import './EmployeeAttendanceHistoryPage.css';

const PAGE_SIZE = 30;

function formatDateLabel(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(value) {
  if (!value) return 'Not checked out';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatWorkedHours(value) {
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

function leftBarClass(status) {
  if (status === 'present') return 'employee-attendance-history__bar employee-attendance-history__bar--present';
  if (status === 'late') return 'employee-attendance-history__bar employee-attendance-history__bar--late';
  return 'employee-attendance-history__bar employee-attendance-history__bar--rejected';
}

function EmployeeAttendanceHistoryPage() {
  const { user } = useAuth();
  const employeeId = user?.employeeId || user?.employee_id;

  const [records, setRecords] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchHistory = useCallback(async (nextOffset = 0, append = false) => {
    if (!employeeId) {
      setLoading(false);
      return;
    }

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await api.get(`/attendance/history/${employeeId}`, {
        params: { limit: PAGE_SIZE, offset: nextOffset }
      });

      const payload = response.data?.data || {};
      const nextRecords = payload.records || [];

      setRecords((prev) => (append ? [...prev, ...nextRecords] : nextRecords));
      setOffset(nextOffset + nextRecords.length);
      setHasMore(nextRecords.length === PAGE_SIZE);
    } catch (error) {
      console.error('Failed to fetch attendance history:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch attendance history');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchHistory(0, false);
  }, [fetchHistory]);

  const stats = useMemo(() => {
    const firstThirty = records.slice(0, 30);
    const presentDays = firstThirty.filter((record) => record.status === 'present' || record.status === 'late').length;
    const lateDays = firstThirty.filter((record) => record.status === 'late').length;
    const withAnyRecord = firstThirty.length;
    const absentDays = Math.max(30 - withAnyRecord, 0);

    return { presentDays, lateDays, absentDays };
  }, [records]);

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    fetchHistory(offset, true);
  };

  if (loading) {
    return (
      <AppShell pageTitle="Attendance History">
        <div className="employee-attendance-history">
          <Card>
            <div className="employee-attendance-history__loading">Loading history...</div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Attendance History">
      <div className="employee-attendance-history">
        <div>
          <h2 className="employee-attendance-history__title">Attendance History</h2>
          <p className="employee-attendance-history__subtitle">Last 30 days summary</p>
        </div>

        <div className="employee-attendance-history__stats">
          <StatCard value={stats.presentDays} label="Days Present" />
          <StatCard value={stats.lateDays} label="Days Late" />
          <StatCard value={stats.absentDays} label="Days Absent" />
        </div>

        <div className="employee-attendance-history__timeline">
          {records.map((record) => {
            const branchName = Array.isArray(record.branch_id) ? record.branch_id[1] : '—';
            const status = record.status || 'rejected';

            return (
              <Card key={record.id} className="employee-attendance-history__item-card">
                <div className="employee-attendance-history__item">
                  <div className={leftBarClass(status)} />
                  <div className="employee-attendance-history__content">
                    <div className="employee-attendance-history__row employee-attendance-history__row--top">
                      <div className="employee-attendance-history__date">{formatDateLabel(record.check_in)}</div>
                      <StatusChip status={status} label={status} tone={statusTone(status)} />
                    </div>

                    <div className="employee-attendance-history__time-range">
                      {formatTime(record.check_in)} → {record.check_out ? formatTime(record.check_out) : 'Not checked out'}
                    </div>

                    <div className="employee-attendance-history__meta">Hours worked: {formatWorkedHours(record.worked_hours)}</div>
                    <div className="employee-attendance-history__meta employee-attendance-history__meta--muted">{branchName}</div>

                    {status === 'rejected' && record.rejection_reason && (
                      <div className="employee-attendance-history__reason">{record.rejection_reason}</div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {hasMore && (
          <Button className="employee-attendance-history__load-more" variant="secondary" onClick={handleLoadMore} loading={loadingMore}>
            Load More
          </Button>
        )}
      </div>
    </AppShell>
  );
}

export default EmployeeAttendanceHistoryPage;
