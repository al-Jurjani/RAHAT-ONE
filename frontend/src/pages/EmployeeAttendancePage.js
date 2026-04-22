import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import AppShell from '../components/layout/AppShell';
import api from '../services/api';
import { Button, Card, StatCard, StatusChip } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { employeeAPI } from '../services/api';
import './EmployeeAttendancePage.css';
import './EmployeeAttendanceHistoryPage.css';

const PKT = 'Asia/Karachi';
const HISTORY_PAGE_SIZE = 30;

function formatTimePKT(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: PKT });
}

function formatDate(value) {
  return value.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

function formatElapsed(from) {
  if (!from) return '0m';
  const start = new Date(String(from).replace(' ', 'T') + 'Z');
  if (Number.isNaN(start.getTime())) return '0m';

  const totalMinutes = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatWorkedHours(hoursValue) {
  if (hoursValue === null || hoursValue === undefined || hoursValue === '') return '—';
  const value = Number(hoursValue);
  if (Number.isNaN(value)) return '—';

  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0 && minutes <= 0) return '—';
  if (minutes === 0) return `${hours}h`;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatDateLabel(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: PKT });
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

function EmployeeAttendancePage() {
  const { user } = useAuth();
  const employeeId = user?.employeeId || user?.employee_id;

  const [now, setNow] = useState(new Date());
  const [todayRecord, setTodayRecord] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [elapsed, setElapsed] = useState('0m');

  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!effectiveTodayRecord?.check_in || effectiveTodayRecord?.check_out) return undefined;

    setElapsed(formatElapsed(todayRecord.check_in));
    const ticker = setInterval(() => {
      setElapsed(formatElapsed(todayRecord.check_in));
    }, 60000);

    return () => clearInterval(ticker);
  }, [todayRecord]);

  const fetchToday = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/attendance/today/${employeeId}`);
      setTodayRecord(response.data?.data || null);
    } catch (error) {
      console.error('Failed to fetch today attendance:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch today attendance');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  const fetchHistory = useCallback(async (nextOffset = 0, append = false) => {
    if (!employeeId) {
      setHistoryLoading(false);
      return;
    }

    if (append) {
      setHistoryLoadingMore(true);
    } else {
      setHistoryLoading(true);
    }

    try {
      const response = await api.get(`/attendance/history/${employeeId}`, {
        params: { limit: HISTORY_PAGE_SIZE, offset: nextOffset }
      });

      const payload = response.data?.data || {};
      const nextRecords = payload.records || [];

      setHistoryRecords((prev) => (append ? [...prev, ...nextRecords] : nextRecords));
      setHistoryOffset(nextOffset + nextRecords.length);
      setHistoryHasMore(nextRecords.length === HISTORY_PAGE_SIZE);
    } catch (error) {
      console.error('Failed to fetch attendance history:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch attendance history');
    } finally {
      setHistoryLoading(false);
      setHistoryLoadingMore(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  useEffect(() => {
    fetchHistory(0, false);
  }, [fetchHistory]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!employeeId) return;
      try {
        const response = await employeeAPI.getProfile(employeeId);
        setProfile(response.data?.data || null);
      } catch (error) {
        console.warn('Failed to load employee profile for attendance summary:', error);
      }
    };
    fetchProfile();
  }, [employeeId]);

  const effectiveTodayRecord = useMemo(() => {
    if (todayRecord) return todayRecord;
    if (!historyRecords.length) return null;
    const latest = historyRecords[0];
    if (!latest?.check_in) return null;
    const recDatePKT = new Date(String(latest.check_in).replace(' ', 'T') + 'Z')
      .toLocaleDateString('en-CA', { timeZone: PKT });
    const todayPKT = new Date().toLocaleDateString('en-CA', { timeZone: PKT });
    return recDatePKT === todayPKT ? latest : null;
  }, [todayRecord, historyRecords]);

  const state = useMemo(() => {
    if (!effectiveTodayRecord) return 'not_checked_in';
    if (effectiveTodayRecord.check_out) return 'checked_out';
    if (effectiveTodayRecord.status === 'present' || effectiveTodayRecord.status === 'late') return 'checked_in';
    return 'not_checked_in';
  }, [effectiveTodayRecord]);

  const historyStats = useMemo(() => {
    const firstThirty = historyRecords.slice(0, 30);
    const presentDays = firstThirty.filter((r) => r.status === 'present' || r.status === 'late').length;
    const lateDays = firstThirty.filter((r) => r.status === 'late').length;
    const absentDays = Math.max(30 - firstThirty.length, 0);
    return { presentDays, lateDays, absentDays };
  }, [historyRecords]);

  const branchName = Array.isArray(effectiveTodayRecord?.branch_id)
    ? effectiveTodayRecord?.branch_id?.[1]
    : (profile?.branch?.name || profile?.branchName || effectiveTodayRecord?.branch_name || 'Not assigned');

  const shiftName = Array.isArray(effectiveTodayRecord?.shift_id)
    ? effectiveTodayRecord?.shift_id?.[1]
    : (profile?.shift?.name || profile?.shiftName || 'Not assigned');

  const getCurrentPosition = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  });

  const handleCheckIn = async () => {
    if (!employeeId) return;
    setActionLoading(true);
    setFeedback(null);

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;

      const response = await api.post('/attendance/checkin', {
        employeeId,
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      });

      const payload = response.data || {};
      const status = payload.status;

      if (status === 'present') {
        setFeedback({ type: 'success', message: 'Checked in successfully.' });
      } else if (status === 'late') {
        setFeedback({ type: 'warning', message: 'Checked in late.' });
      } else if (status === 'rejected') {
        setFeedback({ type: 'danger', message: payload.message || 'Check-in rejected.' });
      }

      await fetchToday();
      await fetchHistory(0, false);
    } catch (error) {
      if (error?.code === 1) {
        setFeedback({
          type: 'danger',
          message: 'Location access is required to check in. Please enable location in your browser settings.'
        });
      } else if (error?.response?.data?.error === 'LOCATION_MISMATCH') {
        const distance = error.response.data?.distance;
        const allowed = error.response.data?.allowed;
        setFeedback({
          type: 'danger',
          message: `You are ${distance}m away from your branch (limit: ${allowed}m). Please check in from your branch location.`
        });
      } else if (error?.response?.data?.error === 'NO_BRANCH') {
        setFeedback({ type: 'info', message: 'No branch assigned. Please contact HR.' });
      } else {
        setFeedback({
          type: 'danger',
          message: error?.response?.data?.message || 'Failed to check in. Please try again.'
        });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!employeeId) return;
    setActionLoading(true);
    setFeedback(null);

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;

      await api.post('/attendance/checkout', {
        employeeId,
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      });

      setFeedback({ type: 'success', message: 'Checked out successfully.' });
      await fetchToday();
      await fetchHistory(0, false);
    } catch (error) {
      if (error?.code === 1) {
        setFeedback({
          type: 'danger',
          message: 'Location access is required to check out. Please enable location in your browser settings.'
        });
      } else {
        setFeedback({
          type: 'danger',
          message: error?.response?.data?.message || 'Failed to check out. Please try again.'
        });
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell pageTitle="Attendance">
        <div className="employee-attendance-page">
          <Card>
            <div className="employee-attendance-page__loading">Loading attendance...</div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Attendance">
      <div className="employee-attendance-page">

        {/* Today's check-in state */}
        <Card className="employee-attendance-page__state-card">
          {state === 'not_checked_in' && (
            <div className="employee-attendance-page__state employee-attendance-page__state--center">
              <div className="employee-attendance-page__hero-icon" aria-hidden="true">📍</div>
              <h2 className="employee-attendance-page__headline">You haven't checked in yet</h2>
              <div className="employee-attendance-page__clock">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: PKT })}</div>
              <div className="employee-attendance-page__date">{formatDate(now)}</div>

              {feedback && (
                <div className={`employee-attendance-page__feedback employee-attendance-page__feedback--${feedback.type}`}>
                  {feedback.message}
                </div>
              )}

              <Button className="employee-attendance-page__action-btn" onClick={handleCheckIn} loading={actionLoading}>
                {actionLoading ? 'Getting your location...' : 'Check In'}
              </Button>
            </div>
          )}

          {state === 'checked_in' && (
            <div className="employee-attendance-page__state employee-attendance-page__state--center">
              <div className="employee-attendance-page__hero-icon employee-attendance-page__hero-icon--success employee-attendance-page__pulse" aria-hidden="true">✓</div>
              <h2 className="employee-attendance-page__headline employee-attendance-page__headline--success">Checked In</h2>
              <div className="employee-attendance-page__since">Since {formatTimePKT(effectiveTodayRecord?.check_in)}</div>
              <div className="employee-attendance-page__elapsed">{elapsed}</div>
              <div className="employee-attendance-page__branch">{branchName}</div>
              <div className="employee-attendance-page__chip-wrap">
                <StatusChip status={effectiveTodayRecord?.status} label={effectiveTodayRecord?.status || 'present'} tone={effectiveTodayRecord?.status === 'late' ? 'warning' : 'success'} />
              </div>

              {feedback && (
                <div className={`employee-attendance-page__feedback employee-attendance-page__feedback--${feedback.type}`}>
                  {feedback.message}
                </div>
              )}

              <Button className="employee-attendance-page__action-btn" onClick={handleCheckOut} loading={actionLoading}>
                {actionLoading ? 'Getting your location...' : 'Check Out'}
              </Button>
            </div>
          )}

          {state === 'checked_out' && (
            <div className="employee-attendance-page__state">
              <div className="employee-attendance-page__summary-grid">
                <div>
                  <div className="employee-attendance-page__label">Check-In</div>
                  <div className="employee-attendance-page__value">{formatTimePKT(effectiveTodayRecord?.check_in)}</div>
                </div>
                <div>
                  <div className="employee-attendance-page__label">Check-Out</div>
                  <div className="employee-attendance-page__value">{formatTimePKT(effectiveTodayRecord?.check_out)}</div>
                </div>
                <div>
                  <div className="employee-attendance-page__label">Total Hours Worked</div>
                  <div className="employee-attendance-page__worked-hours">{formatWorkedHours(effectiveTodayRecord?.worked_hours)}</div>
                </div>
                <div>
                  <div className="employee-attendance-page__label">Branch</div>
                  <div className="employee-attendance-page__value">{branchName}</div>
                </div>
              </div>
              <div className="employee-attendance-page__chip-wrap">
                <StatusChip status={effectiveTodayRecord?.status || 'present'} label={effectiveTodayRecord?.status || 'present'} tone={effectiveTodayRecord?.status === 'late' ? 'warning' : 'success'} />
              </div>
            </div>
          )}
        </Card>

        {/* Branch / shift info */}
        <Card>
          <div className="employee-attendance-page__today-summary">
            <div>
              <div className="employee-attendance-page__label">Branch</div>
              <div className="employee-attendance-page__value">{branchName}</div>
            </div>
            <div>
              <div className="employee-attendance-page__label">Assigned Shift</div>
              <div className="employee-attendance-page__value">{shiftName}</div>
            </div>
          </div>
        </Card>

        {/* Attendance History */}
        <div>
          <h2 className="employee-attendance-history__title">Attendance History</h2>
          <p className="employee-attendance-history__subtitle">Last 30 days summary</p>
        </div>

        <div className="employee-attendance-history__stats">
          <StatCard value={historyStats.presentDays} label="Days Present" />
          <StatCard value={historyStats.lateDays} label="Days Late" />
          <StatCard value={historyStats.absentDays} label="Days Absent" />
        </div>

        {historyLoading ? (
          <Card>
            <div className="employee-attendance-history__loading">Loading history...</div>
          </Card>
        ) : (
          <div className="employee-attendance-history__timeline">
            {historyRecords.map((record) => {
              const branchLabel = Array.isArray(record.branch_id) ? record.branch_id[1] : '—';
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
                        {formatTimePKT(record.check_in)} → {record.check_out ? formatTimePKT(record.check_out) : 'Not checked out'}
                      </div>

                      <div className="employee-attendance-history__meta">Hours worked: {formatWorkedHours(record.worked_hours)}</div>
                      <div className="employee-attendance-history__meta employee-attendance-history__meta--muted">{branchLabel}</div>

                      {status === 'rejected' && record.rejection_reason && (
                        <div className="employee-attendance-history__reason">{record.rejection_reason}</div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {historyHasMore && (
          <Button className="employee-attendance-history__load-more" variant="secondary" onClick={() => fetchHistory(historyOffset, true)} loading={historyLoadingMore}>
            Load More
          </Button>
        )}
      </div>
    </AppShell>
  );
}

export default EmployeeAttendancePage;
