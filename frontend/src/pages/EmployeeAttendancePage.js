import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AppShell from '../components/layout/AppShell';
import api from '../services/api';
import { Button, Card, StatusChip } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { employeeAPI } from '../services/api';
import './EmployeeAttendancePage.css';

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
  const start = new Date(String(from).replace(' ', 'T'));
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

function EmployeeAttendancePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const employeeId = user?.employeeId || user?.employee_id;

  const [now, setNow] = useState(new Date());
  const [todayRecord, setTodayRecord] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [elapsed, setElapsed] = useState('0m');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!todayRecord?.check_in || todayRecord?.check_out) return undefined;

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

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

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

  const state = useMemo(() => {
    if (!todayRecord) return 'not_checked_in';
    if (todayRecord.check_out) return 'checked_out';
    if (todayRecord.status === 'present' || todayRecord.status === 'late') return 'checked_in';
    return 'not_checked_in';
  }, [todayRecord]);

  const branchName = Array.isArray(todayRecord?.branch_id)
    ? todayRecord?.branch_id?.[1]
    : (profile?.branch?.name || profile?.branchName || todayRecord?.branch_name || 'Not assigned');

  const shiftName = Array.isArray(todayRecord?.shift_id)
    ? todayRecord?.shift_id?.[1]
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
        setFeedback({
          type: 'info',
          message: 'No branch assigned. Please contact HR.'
        });
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
      <AppShell pageTitle="Check In / Out">
        <div className="employee-attendance-page">
          <Card>
            <div className="employee-attendance-page__loading">Loading attendance...</div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Check In / Out">
      <div className="employee-attendance-page">
        <Card className="employee-attendance-page__state-card">
          {state === 'not_checked_in' && (
            <div className="employee-attendance-page__state employee-attendance-page__state--center">
              <div className="employee-attendance-page__hero-icon" aria-hidden="true">📍</div>
              <h2 className="employee-attendance-page__headline">You haven't checked in yet</h2>
              <div className="employee-attendance-page__clock">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
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
              <div className="employee-attendance-page__since">Since {formatTime(todayRecord?.check_in)}</div>
              <div className="employee-attendance-page__elapsed">{elapsed}</div>
              <div className="employee-attendance-page__branch">{branchName}</div>
              <div className="employee-attendance-page__chip-wrap">
                <StatusChip status={todayRecord?.status} label={todayRecord?.status || 'present'} tone={todayRecord?.status === 'late' ? 'warning' : 'success'} />
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
                  <div className="employee-attendance-page__value">{formatTime(todayRecord?.check_in)}</div>
                </div>
                <div>
                  <div className="employee-attendance-page__label">Check-Out</div>
                  <div className="employee-attendance-page__value">{formatTime(todayRecord?.check_out)}</div>
                </div>
                <div>
                  <div className="employee-attendance-page__label">Total Hours Worked</div>
                  <div className="employee-attendance-page__worked-hours">{formatWorkedHours(todayRecord?.worked_hours)}</div>
                </div>
                <div>
                  <div className="employee-attendance-page__label">Branch</div>
                  <div className="employee-attendance-page__value">{branchName}</div>
                </div>
              </div>
              <div className="employee-attendance-page__chip-wrap">
                <StatusChip status={todayRecord?.status || 'present'} label={todayRecord?.status || 'present'} tone={todayRecord?.status === 'late' ? 'warning' : 'success'} />
              </div>
              <Button className="employee-attendance-page__link-btn" variant="ghost" onClick={() => navigate('/employee/attendance/history')}>
                View Attendance History
              </Button>
            </div>
          )}
        </Card>

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
      </div>
    </AppShell>
  );
}

export default EmployeeAttendancePage;
