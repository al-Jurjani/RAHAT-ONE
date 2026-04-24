import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AppShell from '../components/layout/AppShell';
import api from '../services/api';
import { Avatar, Button, Card, FormField, Modal, StatCard, StatusChip } from '../components/ui';
import './HRDepartmentManagementPage.css';

const getFieldName = (field) => {
  if (Array.isArray(field)) return field[1];
  if (field && typeof field === 'object' && typeof field.name === 'string') return field.name;
  if (typeof field === 'string') return field;
  return null;
};

const getFieldId = (field) => {
  if (Array.isArray(field)) return field[0];
  if (field && typeof field === 'object' && field.id !== undefined) return field.id;
  if (typeof field === 'number') return field;
  return null;
};

const getAvatarSrc = (imageData) => {
  if (!imageData || imageData === false) return null;
  if (typeof imageData === 'string' && imageData.startsWith('data:')) return imageData;
  if (typeof imageData === 'string' && imageData.length > 0) {
    return `data:image/png;base64,${imageData}`;
  }
  return null;
};

const isVisibleDepartment = (department) => {
  const name = String(department?.name || '').trim().toLowerCase();
  return name !== 'administration';
};

function HRDepartmentManagementPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [branchesById, setBranchesById] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const [employeesCache, setEmployeesCache] = useState({});
  const [employeesLoadingByDept, setEmployeesLoadingByDept] = useState({});

  const [managersCache, setManagersCache] = useState({});
  const [managersLoadingByDept, setManagersLoadingByDept] = useState({});

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetDept, setAssignTargetDept] = useState(null);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [confirmCascade, setConfirmCascade] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDept, setDrawerDept] = useState(null);

  useEffect(() => {
    if (!drawerOpen) return undefined;

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);

    try {
      const [departmentsRes, branchesRes] = await Promise.all([
        api.get('/departments'),
        api.get('/branches')
      ]);

      const deptData = Array.isArray(departmentsRes.data) ? departmentsRes.data : [];
      const branchData = branchesRes.data?.data || [];

      const branchMap = (Array.isArray(branchData) ? branchData : []).reduce((acc, branch) => {
        acc[branch.id] = branch.name;
        return acc;
      }, {});

      setDepartments(deptData.filter(isVisibleDepartment));
      setBranchesById(branchMap);
    } catch (error) {
      console.error('Failed to load department management data:', error);
      toast.error(error.response?.data?.message || 'Failed to load department management');
      setDepartments([]);
      setBranchesById({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const ensureDeptEmployees = useCallback(async (deptId) => {
    if (!deptId || employeesCache[deptId]) return;
    if (employeesLoadingByDept[deptId]) return;

    setEmployeesLoadingByDept((prev) => ({ ...prev, [deptId]: true }));

    try {
      const response = await api.get(`/departments/${deptId}/employees`);
      const employees = Array.isArray(response.data) ? response.data : [];
      setEmployeesCache((prev) => ({ ...prev, [deptId]: employees }));
    } catch (error) {
      console.error(`Failed to fetch employees for department ${deptId}:`, error);
      setEmployeesCache((prev) => ({ ...prev, [deptId]: [] }));
      toast.error(error.response?.data?.message || 'Failed to fetch department employees');
    } finally {
      setEmployeesLoadingByDept((prev) => ({ ...prev, [deptId]: false }));
    }
  }, [employeesCache, employeesLoadingByDept]);

  const ensureDeptManagers = useCallback(async (deptId) => {
    if (!deptId || managersCache[deptId]) return;
    if (managersLoadingByDept[deptId]) return;

    setManagersLoadingByDept((prev) => ({ ...prev, [deptId]: true }));

    try {
      const response = await api.get(`/departments/${deptId}/managers`);
      const managers = Array.isArray(response.data) ? response.data : [];
      setManagersCache((prev) => ({ ...prev, [deptId]: managers }));
    } catch (error) {
      console.error(`Failed to fetch managers for department ${deptId}:`, error);
      setManagersCache((prev) => ({ ...prev, [deptId]: [] }));
      setAssignError(error.response?.data?.message || 'Failed to fetch managers for this department');
    } finally {
      setManagersLoadingByDept((prev) => ({ ...prev, [deptId]: false }));
    }
  }, [managersCache, managersLoadingByDept]);

  const filteredDepartments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return departments;

    return departments.filter((department) =>
      String(department.name || '').toLowerCase().includes(q)
    );
  }, [departments, searchTerm]);

  const stats = useMemo(() => {
    const totalDepartments = departments.length;
    const totalEmployees = departments.reduce((sum, dept) => sum + Number(dept.employee_count || 0), 0);
    const departmentsWithoutManager = departments.filter((dept) => !getFieldName(dept.manager_id)).length;

    return {
      totalDepartments,
      totalEmployees,
      departmentsWithoutManager
    };
  }, [departments]);

  const openAssignManagerModal = async (department) => {
    setAssignTargetDept(department);
    setAssignModalOpen(true);
    setSelectedManagerId('');
    setConfirmCascade(false);
    setAssignSaving(false);
    setAssignError('');

    await ensureDeptManagers(department.id);
  };

  const closeAssignManagerModal = () => {
    setAssignModalOpen(false);
    setAssignTargetDept(null);
    setSelectedManagerId('');
    setConfirmCascade(false);
    setAssignSaving(false);
    setAssignError('');
  };

  const openEmployeesDrawer = async (department) => {
    setDrawerDept(department);
    setDrawerOpen(true);
    await ensureDeptEmployees(department.id);
  };

  const closeEmployeesDrawer = () => {
    setDrawerOpen(false);
    setDrawerDept(null);
  };

  const saveManagerAssignment = async () => {
    if (!assignTargetDept) return;

    if (!selectedManagerId) {
      setAssignError('Please select a manager');
      return;
    }

    const managersForDept = managersCache[assignTargetDept.id] || [];
    const selectedManager = managersForDept.find((manager) => Number(manager.id) === Number(selectedManagerId));

    if (!selectedManager) {
      setAssignError('Selected manager not found');
      return;
    }

    setAssignSaving(true);
    setAssignError('');

    try {
      await api.post(`/departments/${assignTargetDept.id}/assign-manager`, {
        managerId: Number(selectedManager.id),
        managerName: selectedManager.name || '',
        departmentName: assignTargetDept.name || ''
      });

      setDepartments((prev) =>
        prev.map((department) => (
          department.id === assignTargetDept.id
            ? {
                ...department,
                manager_id: {
                  id: Number(selectedManager.id),
                  name: selectedManager.name || ''
                }
              }
            : department
        ))
      );

      toast.success('Manager assigned. Employee records are being updated automatically in the background.');
      closeAssignManagerModal();
    } catch (error) {
      console.error('Failed to assign department manager:', error);
      setAssignError(error.response?.data?.message || 'Failed to assign manager');
    } finally {
      setAssignSaving(false);
    }
  };

  const getBranchName = (branchField) => {
    const tupleName = getFieldName(branchField);
    if (tupleName) return tupleName;

    const branchId = getFieldId(branchField);
    if (branchId && branchesById[branchId]) return branchesById[branchId];

    return null;
  };

  return (
    <AppShell pageTitle="Department Management">
      <div className="hr-department-management">
        <h2 className="hr-department-management__title">Department Management</h2>

        <div className="hr-department-management__stats-row">
          <StatCard label="Total Departments" value={stats.totalDepartments} />
          <StatCard label="Total Employees" value={stats.totalEmployees} />
          <StatCard label="Departments Without Manager" value={stats.departmentsWithoutManager} />
        </div>

        <Card>
          <div className="hr-department-management__search-wrap">
            <FormField
              label="Search"
              type="text"
              value={searchTerm}
              placeholder="Search departments..."
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </Card>

        <div className="hr-department-management__grid">
          {filteredDepartments.map((department) => {
            const managerName = getFieldName(department.manager_id);

            const parentName = getFieldName(department.parent_id);
            const cachedEmployees = employeesCache[department.id] || [];
            const previewEmployees = cachedEmployees.slice(0, 3);
            const remainingCount = Math.max(0, Number(department.employee_count || 0) - previewEmployees.length);

            return (
              <Card
                key={department.id}
                className="hr-department-management__card"
                onMouseEnter={() => ensureDeptEmployees(department.id)}
              >
                <div className="hr-department-management__card-header">
                  <h3 className="hr-department-management__card-title">{department.name || 'Unnamed Department'}</h3>
                  <StatusChip
                    status="employees"
                    tone="neutral"
                    label={`${Number(department.employee_count || 0)} employees`}
                  />
                </div>

                <div className="hr-department-management__card-body">
                  {parentName && (
                    <div className="hr-department-management__parent-line">
                      <span className="hr-department-management__parent-label">Part of:</span>
                      <span className="hr-department-management__parent-name">{parentName}</span>
                    </div>
                  )}

                  <div className="hr-department-management__manager-row">
                    {managerName ? (
                      <>
                        <Avatar name={managerName} size="sm" />
                        <div className="hr-department-management__manager-meta">
                          <div className="hr-department-management__manager-name">{managerName}</div>
                          <div className="hr-department-management__manager-label">Current Manager</div>
                        </div>
                      </>
                    ) : (
                      <div className="hr-department-management__manager-empty">
                        <WarningAmberIcon fontSize="small" />
                        <span>No manager assigned</span>
                      </div>
                    )}
                  </div>

                  <div className="hr-department-management__preview-block">
                    <div className="hr-department-management__preview-label">Employee preview</div>

                    {employeesLoadingByDept[department.id] ? (
                      <div className="hr-department-management__preview-loading">Loading preview...</div>
                    ) : previewEmployees.length > 0 ? (
                      <div className="hr-department-management__preview-row">
                        <div className="hr-department-management__preview-avatars">
                          {previewEmployees.map((employee, index) => (
                            <Avatar
                              key={employee.id || `${department.id}-${index}`}
                              name={employee.name || 'Employee'}
                              src={getAvatarSrc(employee.image_128)}
                              size="sm"
                              className="hr-department-management__preview-avatar"
                            />
                          ))}
                        </div>
                        {remainingCount > 0 && (
                          <span className="hr-department-management__preview-more">+{remainingCount} more</span>
                        )}
                      </div>
                    ) : (
                      <div className="hr-department-management__preview-empty">No preview loaded yet</div>
                    )}
                  </div>
                </div>

                <div className="hr-department-management__card-footer">
                  <Button fullWidth onClick={() => openAssignManagerModal(department)}>
                    Assign Manager
                  </Button>
                  <Button fullWidth variant="ghost" onClick={() => openEmployeesDrawer(department)}>
                    View Employees
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {!loading && filteredDepartments.length === 0 && (
          <Card>
            <div className="hr-department-management__empty">No departments found.</div>
          </Card>
        )}
      </div>

      <Modal
        open={assignModalOpen}
        onClose={closeAssignManagerModal}
        title={assignTargetDept ? assignTargetDept.name : 'Assign Manager'}
        maxWidth="640px"
        footer={(
          <>
            <Button variant="ghost" onClick={closeAssignManagerModal}>Cancel</Button>
            <Button
              onClick={saveManagerAssignment}
              loading={assignSaving}
              disabled={!confirmCascade || !selectedManagerId}
            >
              Assign Manager & Update All Employees
            </Button>
          </>
        )}
      >
        <div className="hr-department-management__modal-body">
          <div className="hr-department-management__modal-current-manager">
            {assignTargetDept && getFieldName(assignTargetDept.manager_id) ? (
              <>
                <Avatar name={getFieldName(assignTargetDept.manager_id)} size="sm" />
                <div className="hr-department-management__modal-manager-text">
                  <span>{getFieldName(assignTargetDept.manager_id)}</span>
                  <small>Current manager</small>
                </div>
              </>
            ) : (
              <span className="hr-department-management__modal-none">None assigned</span>
            )}
          </div>

          <FormField
            label="Select New Manager"
            type="select"
            required
            value={selectedManagerId}
            onChange={(event) => {
              setSelectedManagerId(event.target.value);
              setAssignError('');
            }}
            disabled={!assignTargetDept || managersLoadingByDept[assignTargetDept?.id]}
          >
            <option value="">Select manager</option>
            {(assignTargetDept ? (managersCache[assignTargetDept.id] || []) : []).map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name}{manager.job_title ? ` - ${manager.job_title}` : ''}
              </option>
            ))}
          </FormField>

          <div className="hr-department-management__warning-text">
            This will automatically update the reporting manager for all employees in this department.
          </div>

          <label className="hr-department-management__confirm-row">
            <input
              type="checkbox"
              checked={confirmCascade}
              onChange={(event) => setConfirmCascade(event.target.checked)}
            />
            <span>
              I understand this will cascade to all {Number(assignTargetDept?.employee_count || 0)} employees in this department
            </span>
          </label>

          {assignError && (
            <div className="hr-department-management__error-text">{assignError}</div>
          )}

          {assignSaving && (
            <div className="hr-department-management__saving-text">Assigning manager...</div>
          )}
        </div>
      </Modal>

      {drawerOpen && (
        <div className="hr-department-management__panel-layer" onClick={closeEmployeesDrawer}>
          <aside className="hr-department-management__profile-panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="hr-department-management__panel-close"
              aria-label="Close employees drawer"
              onClick={closeEmployeesDrawer}
            >
              ×
            </button>

            {drawerDept && (
              <div className="hr-department-management__panel-content">
                <div className="hr-department-management__panel-top">
                  <div className="hr-department-management__panel-name">
                    {drawerDept.name} - Employees
                  </div>
                  <div className="hr-department-management__panel-role">
                    {Number(drawerDept.employee_count || 0)} employees
                  </div>
                </div>

                {employeesLoadingByDept[drawerDept.id] ? (
                  <div className="hr-department-management__skeleton-list">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <div key={`skeleton-${idx}`} className="hr-department-management__skeleton-row" />
                    ))}
                  </div>
                ) : (employeesCache[drawerDept.id] || []).length === 0 ? (
                  <div className="hr-department-management__panel-state">No employees in this department</div>
                ) : (
                  <div className="hr-department-management__employee-list">
                    {(employeesCache[drawerDept.id] || []).map((employee) => {
                      const branchName = getBranchName(employee.branch_id);

                      return (
                        <div key={employee.id} className="hr-department-management__employee-row">
                          <div className="hr-department-management__employee-main">
                            <Avatar
                              name={employee.name || 'Employee'}
                              src={getAvatarSrc(employee.image_128)}
                              size="sm"
                            />
                            <div className="hr-department-management__employee-meta">
                              <div className="hr-department-management__employee-name">{employee.name || '—'}</div>
                              <div className="hr-department-management__employee-job">{employee.job_title || '—'}</div>
                            </div>
                          </div>

                          <div className="hr-department-management__employee-side">
                            <div className="hr-department-management__employee-branch-text">
                              {branchName || 'No Branch'}
                            </div>
                            <StatusChip
                              status={branchName ? 'assigned' : 'unassigned'}
                              tone={branchName ? 'info' : 'neutral'}
                              label={branchName || 'No Branch'}
                            />
                            <button
                              type="button"
                              className="hr-department-management__assign-link"
                              onClick={() => navigate('/hr/employees', {
                                state: {
                                  selectedEmployeeId: employee.id,
                                  selectedEmployeeName: employee.name,
                                  fromDepartmentId: drawerDept.id,
                                  fromDepartmentName: drawerDept.name
                                }
                              })}
                            >
                              Assign Branch
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </AppShell>
  );
}

export default HRDepartmentManagementPage;
