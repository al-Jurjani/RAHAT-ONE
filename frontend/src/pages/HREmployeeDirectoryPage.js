import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import AppShell from '../components/layout/AppShell';
import api from '../services/api';
import { Avatar, Button, Card, DataTable, FormField, Modal, StatCard, StatusChip } from '../components/ui';
import './HREmployeeDirectoryPage.css';

const PAGE_SIZE = 50;

const getFieldName = (field) => {
  if (Array.isArray(field)) return field[1];
  if (typeof field === 'string') return field;
  return '—';
};

const getFieldId = (field) => {
  if (Array.isArray(field)) return field[0];
  if (typeof field === 'number') return field;
  return null;
};

function formatJoinDate(value) {
  if (!value) return '—';
  const parsed = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function HREmployeeDirectoryPage() {
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [status, setStatus] = useState('active');
  const [offset, setOffset] = useState(0);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignBranchId, setAssignBranchId] = useState('');
  const [assignShiftId, setAssignShiftId] = useState('');
  const [shiftOptions, setShiftOptions] = useState([]);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState('');

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileData, setProfileData] = useState(null);

  const initializedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const buildEmployeeParams = useCallback((currentOffset = 0) => {
    const params = {
      limit: PAGE_SIZE,
      offset: currentOffset,
      status
    };

    if (debouncedSearch) {
      params.search = debouncedSearch;
    }

    if (selectedDepartment) {
      params.department = Number(selectedDepartment);
    }

    if (selectedBranch) {
      params.branchId = Number(selectedBranch);
    }

    return params;
  }, [debouncedSearch, selectedBranch, selectedDepartment, status]);

  const fetchEmployees = useCallback(async (currentOffset = 0, showFullLoading = false) => {
    if (showFullLoading) {
      setLoading(true);
    } else {
      setPageLoading(true);
    }

    try {
      const response = await api.get('/employees', {
        params: buildEmployeeParams(currentOffset)
      });

      setEmployees(response.data?.employees || []);
      setTotal(Number(response.data?.total || 0));
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch employees');
      setEmployees([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }, [buildEmployeeParams]);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);

    try {
      const [employeesResponse, departmentsResponse, branchesResponse] = await Promise.all([
        api.get('/employees', {
          params: {
            limit: PAGE_SIZE,
            offset: 0,
            status: 'active'
          }
        }),
        api.get('/departments'),
        api.get('/branches')
      ]);

      setEmployees(employeesResponse.data?.employees || []);
      setTotal(Number(employeesResponse.data?.total || 0));
      setDepartments(Array.isArray(departmentsResponse.data) ? departmentsResponse.data : []);

      const branchList = branchesResponse.data?.data || [];
      setBranches(Array.isArray(branchList) ? branchList.filter((branch) => branch.active !== false) : []);
    } catch (error) {
      console.error('Failed to load directory data:', error);
      toast.error(error.response?.data?.message || 'Failed to load employee directory');
      setEmployees([]);
      setTotal(0);
      setDepartments([]);
      setBranches([]);
    } finally {
      initializedRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (!initializedRef.current) {
      return;
    }

    fetchEmployees(offset, false);
  }, [debouncedSearch, selectedDepartment, selectedBranch, status, offset, fetchEmployees]);

  useEffect(() => {
    if (!profileOpen) return undefined;

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [profileOpen]);

  const totalDepartments = departments.length;
  const totalBranches = branches.length;

  const showingStart = total === 0 ? 0 : offset + 1;
  const showingEnd = total === 0 ? 0 : Math.min(offset + employees.length, total);
  const canGoPrev = offset > 0;
  const canGoNext = offset + PAGE_SIZE < total;

  const clearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setSelectedDepartment('');
    setSelectedBranch('');
    setStatus('active');
    setOffset(0);
  };

  const openAssignModal = (employee) => {
    setAssignTarget(employee);
    setAssignBranchId(String(getFieldId(employee.branch_id) || ''));
    setAssignShiftId(String(getFieldId(employee.shift_id) || ''));
    setShiftOptions([]);
    setAssignError('');
    setAssignModalOpen(true);
  };

  const closeAssignModal = () => {
    setAssignModalOpen(false);
    setAssignTarget(null);
    setAssignBranchId('');
    setAssignShiftId('');
    setShiftOptions([]);
    setAssignError('');
    setShiftLoading(false);
    setAssignSaving(false);
  };

  const fetchBranchShifts = useCallback(async (branchId) => {
    if (!branchId) {
      setShiftOptions([]);
      return;
    }

    setShiftLoading(true);
    try {
      const response = await api.get(`/branches/${branchId}/shifts`);
      const shifts = response.data?.data || [];
      setShiftOptions(Array.isArray(shifts) ? shifts : []);
    } catch (error) {
      console.error('Failed to fetch shifts:', error);
      setShiftOptions([]);
      setAssignError(error.response?.data?.message || 'Failed to load shifts for selected branch');
    } finally {
      setShiftLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!assignModalOpen) return;

    if (!assignBranchId) {
      setShiftOptions([]);
      setAssignShiftId('');
      return;
    }

    fetchBranchShifts(assignBranchId);
  }, [assignBranchId, assignModalOpen, fetchBranchShifts]);

  const saveAssignment = async () => {
    if (!assignTarget) return;
    if (!assignBranchId) {
      setAssignError('Branch is required');
      return;
    }

    setAssignSaving(true);
    setAssignError('');

    try {
      await api.patch(`/employees/${assignTarget.id}/branch`, {
        branchId: Number(assignBranchId),
        shiftId: assignShiftId ? Number(assignShiftId) : null
      });

      toast.success('Employee branch assignment updated successfully');
      closeAssignModal();
      await fetchEmployees(offset, false);
    } catch (error) {
      console.error('Failed to update employee branch:', error);
      setAssignError(error.response?.data?.message || 'Failed to update branch assignment');
    } finally {
      setAssignSaving(false);
    }
  };

  const openProfilePanel = async (employee) => {
    setProfileOpen(true);
    setProfileLoading(true);
    setProfileError('');
    setProfileData(null);

    try {
      const response = await api.get(`/employees/${employee.id}`);
      setProfileData(response.data || null);
    } catch (error) {
      console.error('Failed to fetch employee profile:', error);
      setProfileError(error.response?.data?.message || 'Failed to fetch employee profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfilePanel = () => {
    setProfileOpen(false);
    setProfileData(null);
    setProfileError('');
    setProfileLoading(false);
  };

  const employeeColumns = useMemo(() => ([
    {
      key: 'name',
      label: 'Employee',
      render: (_, row) => (
        <div className="hr-employee-directory__employee-cell">
          <Avatar
            name={row.name || 'Employee'}
            src={row.image_128 ? `data:image/png;base64,${row.image_128}` : undefined}
            size="md"
          />
          <div className="hr-employee-directory__employee-meta">
            <div className="hr-employee-directory__employee-name">{row.name || '—'}</div>
            <div className="hr-employee-directory__employee-role">{row.job_title || '—'}</div>
          </div>
        </div>
      )
    },
    {
      key: 'department_id',
      label: 'Department',
      render: (value) => <span className="hr-employee-directory__table-sm">{getFieldName(value)}</span>
    },
    {
      key: 'parent_id',
      label: 'Manager',
      render: (value) => <span className="hr-employee-directory__table-sm">{getFieldName(value)}</span>
    },
    {
      key: 'branch_id',
      label: 'Branch',
      render: (value) => {
        const branchName = getFieldName(value);
        const hasBranch = getFieldId(value) !== null;

        if (!hasBranch) {
          return <span className="hr-employee-directory__table-muted">No Branch</span>;
        }

        return <StatusChip status="assigned" label={branchName} tone="info" />;
      }
    },
    {
      key: 'shift_id',
      label: 'Shift',
      render: (value) => <span className="hr-employee-directory__table-xs">{getFieldName(value)}</span>
    },
    {
      key: 'work_email',
      label: 'Contact',
      render: (_, row) => (
        <div className="hr-employee-directory__contact-cell">
          <div className="hr-employee-directory__contact-email">{row.work_email || '—'}</div>
          <div className="hr-employee-directory__contact-phone">{row.mobile_phone || '—'}</div>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="hr-employee-directory__actions">
          <Button size="sm" variant="ghost" onClick={() => openAssignModal(row)}>
            Assign Branch
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openProfilePanel(row)}>
            View Profile
          </Button>
        </div>
      )
    }
  ]), []);

  return (
    <AppShell pageTitle="Employee Directory">
      <div className="hr-employee-directory">
        <h2 className="hr-employee-directory__title">Employee Directory</h2>

        <Card>
          <div className="hr-employee-directory__filters">
            <FormField
              label="Search"
              type="text"
              value={searchInput}
              placeholder="Search by name..."
              onChange={(event) => {
                setSearchInput(event.target.value);
                setOffset(0);
              }}
            />

            <FormField
              label="Department"
              type="select"
              value={selectedDepartment}
              onChange={(event) => {
                setSelectedDepartment(event.target.value);
                setOffset(0);
              }}
            >
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </FormField>

            <FormField
              label="Branch"
              type="select"
              value={selectedBranch}
              onChange={(event) => {
                setSelectedBranch(event.target.value);
                setOffset(0);
              }}
            >
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </FormField>

            <div className="hr-employee-directory__status-block">
              <span className="hr-employee-directory__status-label">Status</span>
              <div className="hr-employee-directory__status-toggle">
                <Button
                  variant={status === 'active' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setStatus('active');
                    setOffset(0);
                  }}
                >
                  Active
                </Button>
                <Button
                  variant={status === 'inactive' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setStatus('inactive');
                    setOffset(0);
                  }}
                >
                  Inactive
                </Button>
              </div>
            </div>

            <div className="hr-employee-directory__clear-wrap">
              <Button variant="ghost" onClick={clearFilters}>Clear Filters</Button>
            </div>
          </div>
        </Card>

        <div className="hr-employee-directory__stats-row">
          <StatCard label="Total Employees" value={total} />
          <StatCard label="Departments" value={totalDepartments} />
          <StatCard label="Branches" value={totalBranches} />
        </div>

        <Card>
          <DataTable
            columns={employeeColumns}
            data={employees}
            loading={loading || pageLoading}
            emptyText="No employees found"
          />

          <div className="hr-employee-directory__pagination">
            <div className="hr-employee-directory__pagination-summary">
              Showing {showingStart}-{showingEnd} of {total} employees
            </div>

            <div className="hr-employee-directory__pagination-actions">
              <Button
                variant="ghost"
                onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
                disabled={!canGoPrev || loading || pageLoading}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                disabled={!canGoNext || loading || pageLoading}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={assignModalOpen}
        onClose={closeAssignModal}
        title={`Assign Branch${assignTarget?.name ? ` - ${assignTarget.name}` : ''}`}
        maxWidth="560px"
        footer={(
          <>
            <Button variant="ghost" onClick={closeAssignModal}>Cancel</Button>
            <Button onClick={saveAssignment} loading={assignSaving}>Save</Button>
          </>
        )}
      >
        <div className="hr-employee-directory__modal-body">
          <FormField
            label="Branch"
            type="select"
            required
            value={assignBranchId}
            onChange={(event) => {
              setAssignBranchId(event.target.value);
              setAssignShiftId('');
              setAssignError('');
            }}
          >
            <option value="">Select a branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </FormField>

          <FormField
            label="Shift"
            type="select"
            value={assignShiftId}
            onChange={(event) => {
              setAssignShiftId(event.target.value);
              setAssignError('');
            }}
            disabled={!assignBranchId || shiftLoading}
          >
            {!assignBranchId ? (
              <option value="">Select a branch first</option>
            ) : (
              <>
                <option value="">No shift</option>
                {shiftOptions.map((shift) => (
                  <option key={shift.id} value={shift.id}>{shift.name}</option>
                ))}
              </>
            )}
          </FormField>

          {assignError && (
            <div className="hr-employee-directory__error-text">{assignError}</div>
          )}
        </div>
      </Modal>

      {profileOpen && (
        <div className="hr-employee-directory__panel-layer" onClick={closeProfilePanel}>
          <aside className="hr-employee-directory__profile-panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="hr-employee-directory__panel-close"
              aria-label="Close profile panel"
              onClick={closeProfilePanel}
            >
              ×
            </button>

            {profileLoading ? (
              <div className="hr-employee-directory__panel-state">Loading profile...</div>
            ) : profileError ? (
              <div className="hr-employee-directory__panel-state hr-employee-directory__panel-state--error">{profileError}</div>
            ) : profileData ? (
              <div className="hr-employee-directory__panel-content">
                <div className="hr-employee-directory__panel-top">
                  <Avatar
                    name={profileData.name || 'Employee'}
                    src={profileData.image_512 ? `data:image/png;base64,${profileData.image_512}` : undefined}
                    size="lg"
                    className="hr-employee-directory__panel-avatar"
                  />

                  <div className="hr-employee-directory__panel-name">{profileData.name || '—'}</div>
                  <div className="hr-employee-directory__panel-role">{profileData.job_title || '—'}</div>

                  <div className="hr-employee-directory__panel-chips">
                    <StatusChip status="department" label={getFieldName(profileData.department_id)} tone="info" />
                    <StatusChip
                      status={profileData.active ? 'active' : 'inactive'}
                      label={profileData.active ? 'Active' : 'Inactive'}
                      tone={profileData.active ? 'success' : 'neutral'}
                    />
                  </div>
                </div>

                <div className="hr-employee-directory__info-grid">
                  <div className="hr-employee-directory__info-item">
                    <span className="hr-employee-directory__info-label">Employee ID</span>
                    <span className="hr-employee-directory__info-value">{profileData.id || '—'}</span>
                  </div>
                  <div className="hr-employee-directory__info-item">
                    <span className="hr-employee-directory__info-label">Join Date</span>
                    <span className="hr-employee-directory__info-value">{formatJoinDate(profileData.create_date)}</span>
                  </div>
                  <div className="hr-employee-directory__info-item">
                    <span className="hr-employee-directory__info-label">Work Email</span>
                    <span className="hr-employee-directory__info-value">{profileData.work_email || '—'}</span>
                  </div>
                  <div className="hr-employee-directory__info-item">
                    <span className="hr-employee-directory__info-label">Mobile Phone</span>
                    <span className="hr-employee-directory__info-value">{profileData.mobile_phone || '—'}</span>
                  </div>
                  <div className="hr-employee-directory__info-item">
                    <span className="hr-employee-directory__info-label">Manager</span>
                    <span className="hr-employee-directory__info-value">{getFieldName(profileData.parent_id)}</span>
                  </div>
                  <div className="hr-employee-directory__info-item">
                    <span className="hr-employee-directory__info-label">Branch</span>
                    <span className="hr-employee-directory__info-value">{getFieldName(profileData.branch_id)}</span>
                  </div>
                  <div className="hr-employee-directory__info-item">
                    <span className="hr-employee-directory__info-label">Shift</span>
                    <span className="hr-employee-directory__info-value">{getFieldName(profileData.shift_id)}</span>
                  </div>
                  <div className="hr-employee-directory__info-item">
                    <span className="hr-employee-directory__info-label">Employee Type</span>
                    <span className="hr-employee-directory__info-value">{profileData.employee_type || '—'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hr-employee-directory__panel-state">No profile data found.</div>
            )}
          </aside>
        </div>
      )}
    </AppShell>
  );
}

export default HREmployeeDirectoryPage;
