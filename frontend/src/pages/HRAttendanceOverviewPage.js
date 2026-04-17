import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import DownloadIcon from '@mui/icons-material/Download';
import AppShell from '../components/layout/AppShell';
import api from '../services/api';
import { Button, Card, DataTable, FormField, StatCard, StatusChip } from '../components/ui';
import './HRAttendanceOverviewPage.css';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'no_record', label: 'No Record' }
];

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeLabel(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'h:mm a');
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

function downloadCsv(filename, rows) {
  const escape = (value) => {
    const text = value == null ? '' : String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function HRAttendanceOverviewPage() {
  const [branches, setBranches] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [selectedDate, setSelectedDate] = useState(todayString());
  const [selectedBranch, setSelectedBranch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchBranches = useCallback(async () => {
    try {
      const response = await api.get('/branches');
      setBranches(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load branches:', error);
      toast.error(error.response?.data?.message || 'Failed to load branches');
    }
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const params = { date: selectedDate };
      if (selectedBranch) params.branchId = Number(selectedBranch);

      const response = await api.get('/attendance/hr/summary', { params });
      setRecords(response.data?.data || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load attendance summary:', error);
      toast.error(error.response?.data?.message || 'Failed to load attendance summary');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedBranch]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchAttendance();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchAttendance]);

  const totalActiveEmployees = useMemo(() => {
    if (selectedBranch) {
      const branch = branches.find((item) => Number(item.id) === Number(selectedBranch));
      return Number(branch?.employee_count || 0);
    }

    return branches.reduce((sum, branch) => sum + Number(branch.employee_count || 0), 0);
  }, [branches, selectedBranch]);

  const uniqueEmployeesWithRecord = useMemo(() => {
    const set = new Set();
    records.forEach((record) => {
      if (record.employeeId) set.add(record.employeeId);
    });
    return set.size;
  }, [records]);

  const stats = useMemo(() => {
    const present = records.filter((record) => record.status === 'present').length;
    const late = records.filter((record) => record.status === 'late').length;
    const rejected = records.filter((record) => record.status === 'rejected').length;
    const notCheckedIn = Math.max(totalActiveEmployees - uniqueEmployeesWithRecord, 0);

    return { present, late, rejected, notCheckedIn };
  }, [records, totalActiveEmployees, uniqueEmployeesWithRecord]);

  const mappedRecords = useMemo(() => {
    const list = records.map((record) => ({
      id: record.id,
      employeeName: record.employeeName || '—',
      branchName: record.branchName || '—',
      shiftName: record.shiftName || '—',
      checkIn: record.check_in,
      checkOut: record.check_out,
      workedHours: record.worked_hours,
      status: record.status || 'no_record',
      distanceFromBranch: record.distance_from_branch,
      date: selectedDate
    }));

    const noRecordRows = Array.from({ length: stats.notCheckedIn }).map((_, index) => ({
      id: `no-record-${index + 1}`,
      employeeName: 'Not Checked In',
      branchName: selectedBranch
        ? (branches.find((branch) => Number(branch.id) === Number(selectedBranch))?.name || '—')
        : 'All Branches',
      shiftName: '—',
      checkIn: null,
      checkOut: null,
      workedHours: null,
      status: 'no_record',
      distanceFromBranch: null,
      date: selectedDate
    }));

    return [...list, ...noRecordRows];
  }, [records, selectedDate, stats.notCheckedIn, selectedBranch, branches]);

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return mappedRecords;
    return mappedRecords.filter((row) => row.status === statusFilter);
  }, [mappedRecords, statusFilter]);

  const columns = [
    { key: 'employeeName', label: 'Employee Name' },
    { key: 'branchName', label: 'Branch' },
    { key: 'shiftName', label: 'Shift' },
    {
      key: 'checkIn',
      label: 'Check-In',
      render: (value) => formatTimeLabel(value)
    },
    {
      key: 'checkOut',
      label: 'Check-Out',
      render: (value) => formatTimeLabel(value)
    },
    {
      key: 'workedHours',
      label: 'Worked Hours',
      render: (value) => formatHoursLabel(value)
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <StatusChip
          status={value}
          label={value === 'no_record' ? 'Not Checked In' : value}
          tone={statusTone(value)}
        />
      )
    },
    {
      key: 'distanceFromBranch',
      label: 'Distance',
      render: (value) => (
        <span className="hr-attendance-page__distance">
          {value !== null && value !== undefined ? `${Math.round(Number(value))}m from branch` : '—'}
        </span>
      )
    }
  ];

  const handleExportCsv = () => {
    const csvRows = [
      ['Employee Name', 'Branch', 'Shift', 'Date', 'Check-In', 'Check-Out', 'Worked Hours', 'Status', 'Distance']
    ];

    filteredRows.forEach((row) => {
      csvRows.push([
        row.employeeName,
        row.branchName,
        row.shiftName,
        row.date,
        formatTimeLabel(row.checkIn),
        formatTimeLabel(row.checkOut),
        formatHoursLabel(row.workedHours),
        row.status === 'no_record' ? 'Not Checked In' : row.status,
        row.distanceFromBranch !== null && row.distanceFromBranch !== undefined
          ? `${Math.round(Number(row.distanceFromBranch))}m from branch`
          : '—'
      ]);
    });

    downloadCsv(`attendance_${selectedDate}.csv`, csvRows);
  };

  return (
    <AppShell pageTitle="Attendance Overview">
      <div className="hr-attendance-page">
        <div className="hr-attendance-page__header">
          <h2 className="hr-attendance-page__title">Attendance Overview</h2>
          <Button variant="ghost" onClick={handleExportCsv}>
            <DownloadIcon fontSize="small" />
            Export CSV
          </Button>
        </div>

        <Card>
          <div className="hr-attendance-page__filters">
            <FormField
              label="Date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />

            <FormField
              label="Branch"
              type="select"
              value={selectedBranch}
              onChange={(event) => setSelectedBranch(event.target.value)}
            >
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </FormField>

            <FormField
              label="Status"
              type="select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </FormField>
          </div>
        </Card>

        <div className="hr-attendance-page__stats">
          <StatCard value={stats.present} label="Present Today" />
          <StatCard value={stats.late} label="Late Today" />
          <StatCard value={stats.rejected} label="Rejected" />
          <StatCard value={stats.notCheckedIn} label="Not Checked In" />
        </div>

        <Card>
          <div className="hr-attendance-page__table-top">
            <div className="hr-attendance-page__updated-at">
              Last updated: {lastUpdated ? format(lastUpdated, 'h:mm:ss a') : '—'}
            </div>
          </div>
          <DataTable
            columns={columns}
            data={filteredRows}
            loading={loading}
            emptyText="No attendance records found for selected filters"
          />
        </Card>
      </div>
    </AppShell>
  );
}

export default HRAttendanceOverviewPage;
