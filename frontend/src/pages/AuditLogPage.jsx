import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import AppShell from '../components/layout/AppShell';
import { auditAPI } from '../services/api';
import { Button, Card, DataTable, FormField, Modal, StatusChip, LoadingSpinner } from '../components/ui';

const PAGE_SIZE = 100;

const MODULE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'expense', label: 'Expense' },
  { value: 'leave', label: 'Leave' },
  { value: 'onboarding', label: 'Onboarding' }
];

const ACTOR_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr', label: 'HR' },
  { value: 'system', label: 'System' }
];

function formatTitle(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDateTime(value) {
  if (!value) return '—';
  return format(new Date(value), 'd MMM, h:mma').replace('AM', 'am').replace('PM', 'pm');
}

function safeDetails(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return { value };
    }
  }
  return value;
}

function prettifyKey(key) {
  const overrides = {
    odooId: 'Odoo ID',
    odooLeaveId: 'Odoo Leave ID',
    odooEmployeeId: 'Odoo Employee ID',
    sentTo: 'Sent To',
    leaveType: 'Leave Type',
    startDate: 'Start Date',
    endDate: 'End Date',
    fraudScore: 'Fraud Score',
    joiningDate: 'Joining Date',
    managerEmail: 'Manager Email'
  };

  if (overrides[key]) return overrides[key];
  return formatTitle(key);
}

function isDateKey(key) {
  return /(date)$/i.test(key);
}

function parseDateLike(value) {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatPKR(amount) {
  return `PKR ${Number(amount).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

function summarizeDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return details ? String(details) : 'Open details';
  }

  const pairs = Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 3)
    .map(([key, value]) => {
      const label = formatTitle(key);
      if (typeof value === 'number') {
        return `${label}: ${Number.isInteger(value) ? value : value.toFixed(2)}`;
      }
      if (typeof value === 'boolean') {
        return `${label}: ${value ? 'Yes' : 'No'}`;
      }
      if (typeof value === 'object') {
        return `${label}: ${JSON.stringify(value)}`;
      }
      return `${label}: ${value}`;
    });

  return pairs.length ? pairs.join(', ') : 'Open details';
}

function renderDetailValue(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  if (Array.isArray(value)) {
    return value.length ? value.map((item) => renderDetailValue(item)).join(', ') : '[]';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatDetailValueByKey(key, value) {
  if (value === null || value === undefined || value === '') return '—';

  if (typeof value === 'number') {
    if (key.toLowerCase().includes('amount')) {
      return formatPKR(value);
    }
    if (value >= 0 && value <= 1) {
      return `${Math.round(value * 100)}%`;
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  if (isDateKey(key)) {
    const parsed = parseDateLike(value);
    if (parsed) return format(parsed, 'd MMM yyyy');
  }

  return renderDetailValue(value);
}

function renderDetailsList(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return (
      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
        No additional details
      </div>
    );
  }

  const entries = Object.entries(details).filter(([, value]) => value !== undefined && value !== null && value !== '');

  if (!entries.length) {
    return (
      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
        No additional details
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      {entries.map(([key, value]) => (
        <div
          key={key}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(180px, 220px) 1fr',
            gap: 'var(--space-3)',
            alignItems: 'start',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: 'var(--space-2)'
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {prettifyKey(key)}
          </div>
          <div style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap' }}>
            {formatDetailValueByKey(key, value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function moduleTone(module) {
  if (module === 'expense') return 'info';
  if (module === 'leave') return 'success';
  if (module === 'onboarding') return 'warning';
  return 'neutral';
}

function actorTone(actor) {
  if (actor === 'employee') return 'info';
  if (actor === 'manager') return 'warning';
  if (actor === 'hr') return 'success';
  return 'neutral';
}

function AuditLogPage() {
  const [filters, setFilters] = useState({
    module: '',
    actor: '',
    startDate: '',
    endDate: '',
    employeeName: ''
  });
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async (pageOffset = 0, replace = false) => {
    if (replace) {
      setLoading(true);
      setError('');
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await auditAPI.getHrLogs({
        module: filters.module || undefined,
        actor: filters.actor || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        limit: PAGE_SIZE,
        offset: pageOffset
      });

      const payload = response.data || {};
      const nextLogs = Array.isArray(payload.logs) ? payload.logs : [];
      const totalCount = Number(payload.total || 0);
      const mergedLogs = replace ? nextLogs : [...logs, ...nextLogs];

      setLogs(mergedLogs);
      setTotal(totalCount);
      setOffset(pageOffset + nextLogs.length);
    } catch (requestError) {
      console.error('Failed to load audit logs:', requestError);
      setError(requestError.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setLogs([]);
    setTotal(0);
    setOffset(0);
    setSelectedLog(null);
    fetchLogs(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.module, filters.actor, filters.startDate, filters.endDate]);

  const visibleLogs = useMemo(() => {
    const query = filters.employeeName.trim().toLowerCase();

    return logs.filter((log) => {
      const employeeMatch = !query || (log.employeeName || '').toLowerCase().includes(query);
      const actorMatch = !filters.actor || (log.actor || '') === filters.actor;
      const moduleMatch = !filters.module || (log.module || '') === filters.module;
      return employeeMatch && actorMatch && moduleMatch;
    });
  }, [filters.actor, filters.employeeName, filters.module, logs]);

  const columns = [
    {
      key: 'createdAt',
      label: 'Time',
      render: (value, row) => formatDateTime(value || row.createdAt)
    },
    {
      key: 'employeeName',
      label: 'Employee'
    },
    {
      key: 'module',
      label: 'Module',
      render: (value) => <StatusChip status={value} label={formatTitle(value)} tone={moduleTone(value)} />
    },
    {
      key: 'action',
      label: 'Action',
      render: (value) => formatTitle(value)
    },
    {
      key: 'actor',
      label: 'Actor',
      render: (value) => <StatusChip status={value} label={formatTitle(value)} tone={actorTone(value)} />
    },
    {
      key: 'detailsSummary',
      label: 'Details',
      render: (value) => value || 'Open details'
    }
  ];

  const tableRows = visibleLogs.map((log) => {
    const details = safeDetails(log.details);
    return {
      ...log,
      detailsSummary: summarizeDetails(details),
      parsedDetails: details,
      createdAt: log.createdAt || log.created_at
    };
  });

  const handleClearFilters = () => {
    setFilters({
      module: '',
      actor: '',
      startDate: '',
      endDate: '',
      employeeName: ''
    });
  };

  const handleLoadMore = () => {
    fetchLogs(offset, false);
  };

  return (
    <AppShell pageTitle="Audit Log">
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <Card>
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
              <FormField
                label="Module"
                type="select"
                name="module"
                value={filters.module}
                onChange={(event) => setFilters((prev) => ({ ...prev, module: event.target.value }))}
              >
                {MODULE_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                ))}
              </FormField>

              <FormField
                label="Actor"
                type="select"
                name="actor"
                value={filters.actor}
                onChange={(event) => setFilters((prev) => ({ ...prev, actor: event.target.value }))}
              >
                {ACTOR_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                ))}
              </FormField>

              <FormField
                label="Start Date"
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
              />

              <FormField
                label="End Date"
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
              />

              <FormField
                label="Employee Name"
                type="text"
                name="employeeName"
                value={filters.employeeName}
                onChange={(event) => setFilters((prev) => ({ ...prev, employeeName: event.target.value }))}
                placeholder="Search loaded results"
              />

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button variant="ghost" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {error && (
          <Card>
            <div style={{ color: 'var(--status-danger)' }}>
              {error}
            </div>
          </Card>
        )}

        {loading && logs.length === 0 ? (
          <Card>
            <LoadingSpinner />
          </Card>
        ) : (
          <Card>
            <DataTable
              columns={columns}
              data={tableRows}
              loading={loading && tableRows.length === 0}
              emptyText="No audit logs found"
              onRowClick={(row) => setSelectedLog(row)}
            />
            {loadingMore && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-4)' }}>
                <LoadingSpinner center={false} />
              </div>
            )}
            {total > logs.length && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-4)' }}>
                <Button variant="secondary" onClick={handleLoadMore} loading={loadingMore}>
                  Load More
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>

      <Modal
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Audit Details"
        maxWidth="720px"
      >
        {selectedLog && (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Employee</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedLog.employeeName || '—'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Module</div>
                <div style={{ marginTop: 'var(--space-1)' }}>
                  <StatusChip status={selectedLog.module} label={formatTitle(selectedLog.module)} tone={moduleTone(selectedLog.module)} />
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actor</div>
                <div style={{ marginTop: 'var(--space-1)' }}>
                  <StatusChip status={selectedLog.actor} label={formatTitle(selectedLog.actor)} tone={actorTone(selectedLog.actor)} />
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Time</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatDateTime(selectedLog.createdAt)}</div>
              </div>
            </div>

            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>Action</div>
              <div style={{ color: 'var(--text-primary)', fontSize: 'var(--text-base)', fontWeight: 600 }}>
                {formatTitle(selectedLog.action)}
              </div>
            </div>

            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>Details</div>
              {renderDetailsList(selectedLog.parsedDetails)}
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

export default AuditLogPage;
