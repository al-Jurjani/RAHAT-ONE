import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddIcon from '@mui/icons-material/Add';
import AppShell from '../components/layout/AppShell';
import api from '../services/api';
import { Button, Card, DataTable, FormField, Modal, StatusChip } from '../components/ui';
import './HRBranchManagementPage.css';

const DEFAULT_BRANCH_FORM = {
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  radius_meters: 200
};

const DEFAULT_SHIFT_FORM = {
  name: '',
  start_time: 9.0,
  end_time: 17.0,
  grace_minutes: 15,
  workingDays: [0, 1, 2, 3, 4]
};

const DAYS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' }
];

function toTimeLabel(decimalValue) {
  const value = Number(decimalValue);
  if (Number.isNaN(value)) return '—';

  const hours24 = Math.floor(value);
  const minutes = Math.round((value - hours24) * 60);
  const normalizedHours = hours24 % 24;
  const period = normalizedHours >= 12 ? 'PM' : 'AM';
  const hours12 = normalizedHours % 12 === 0 ? 12 : normalizedHours % 12;
  const minuteLabel = String(minutes).padStart(2, '0');
  return `${hours12}:${minuteLabel} ${period}`;
}

function toWorkingDaysLabel(daysString) {
  const parsed = String(daysString || '')
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => !Number.isNaN(item))
    .sort((a, b) => a - b);

  if (parsed.length === 5 && parsed.join(',') === '0,1,2,3,4') return 'Mon-Fri';
  if (parsed.length === 7 && parsed.join(',') === '0,1,2,3,4,5,6') return 'All Week';

  const lookup = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return parsed.map((day) => lookup[day] || '?').join(', ');
}

function parseWorkingDays(daysString) {
  const values = String(daysString || '')
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => !Number.isNaN(item));

  return values.length ? values : [0, 1, 2, 3, 4];
}

function HRBranchManagementPage() {
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [expandedBranchIds, setExpandedBranchIds] = useState({});

  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [branchForm, setBranchForm] = useState(DEFAULT_BRANCH_FORM);
  const [branchSaving, setBranchSaving] = useState(false);

  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [currentShiftBranchId, setCurrentShiftBranchId] = useState(null);
  const [shiftForm, setShiftForm] = useState(DEFAULT_SHIFT_FORM);
  const [shiftSaving, setShiftSaving] = useState(false);

  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [branchToDeactivate, setBranchToDeactivate] = useState(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const [setManagerModalOpen, setSetManagerModalOpen] = useState(false);
  const [setManagerBranch, setSetManagerBranch] = useState(null);
  const [setManagerEmployees, setSetManagerEmployees] = useState([]);
  const [setManagerEmployeeId, setSetManagerEmployeeId] = useState('');
  const [setManagerLoading, setSetManagerLoading] = useState(false);
  const [setManagerSaving, setSetManagerSaving] = useState(false);

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/branches');
      setBranches(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load branches:', error);
      toast.error(error.response?.data?.message || 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const openAddBranchModal = () => {
    setEditingBranch(null);
    setBranchForm(DEFAULT_BRANCH_FORM);
    setBranchModalOpen(true);
  };

  const openEditBranchModal = (branch) => {
    setEditingBranch(branch);
    setBranchForm({
      name: branch.name || '',
      address: branch.address || '',
      latitude: branch.latitude ?? '',
      longitude: branch.longitude ?? '',
      radius_meters: branch.radius_meters ?? 200
    });
    setBranchModalOpen(true);
  };

  const saveBranch = async () => {
    if (!branchForm.name || branchForm.latitude === '' || branchForm.longitude === '') {
      toast.error('Branch Name, Latitude and Longitude are required');
      return;
    }

    setBranchSaving(true);
    try {
      const payload = {
        name: branchForm.name,
        address: branchForm.address,
        latitude: Number(branchForm.latitude),
        longitude: Number(branchForm.longitude),
        radius_meters: Number(branchForm.radius_meters || 200)
      };

      if (editingBranch) {
        await api.patch(`/branches/${editingBranch.id}`, payload);
        toast.success('Branch updated successfully');
      } else {
        await api.post('/branches', payload);
        toast.success('Branch created successfully');
      }

      setBranchModalOpen(false);
      await fetchBranches();
    } catch (error) {
      console.error('Failed to save branch:', error);
      toast.error(error.response?.data?.message || 'Failed to save branch');
    } finally {
      setBranchSaving(false);
    }
  };

  const toggleShifts = (branchId) => {
    setExpandedBranchIds((prev) => ({ ...prev, [branchId]: !prev[branchId] }));
  };

  const openAddShiftModal = (branchId) => {
    setEditingShift(null);
    setCurrentShiftBranchId(branchId);
    setShiftForm(DEFAULT_SHIFT_FORM);
    setShiftModalOpen(true);
  };

  const openEditShiftModal = (branchId, shift) => {
    setEditingShift(shift);
    setCurrentShiftBranchId(branchId);
    setShiftForm({
      name: shift.name || '',
      start_time: shift.start_time ?? 9.0,
      end_time: shift.end_time ?? 17.0,
      grace_minutes: shift.grace_minutes ?? 15,
      workingDays: parseWorkingDays(shift.days_of_week)
    });
    setShiftModalOpen(true);
  };

  const toggleWorkingDay = (dayValue) => {
    setShiftForm((prev) => {
      const exists = prev.workingDays.includes(dayValue);
      const nextDays = exists
        ? prev.workingDays.filter((item) => item !== dayValue)
        : [...prev.workingDays, dayValue];

      return {
        ...prev,
        workingDays: nextDays.sort((a, b) => a - b)
      };
    });
  };

  const saveShift = async () => {
    if (!shiftForm.name || shiftForm.start_time === '' || shiftForm.end_time === '') {
      toast.error('Shift Name, Start Time and End Time are required');
      return;
    }

    setShiftSaving(true);
    try {
      const payload = {
        name: shiftForm.name,
        start_time: Number(shiftForm.start_time),
        end_time: Number(shiftForm.end_time),
        grace_minutes: Number(shiftForm.grace_minutes || 15),
        days_of_week: (shiftForm.workingDays.length ? shiftForm.workingDays : [0, 1, 2, 3, 4]).join(',')
      };

      if (editingShift) {
        await api.patch(`/branches/shifts/${editingShift.id}`, payload);
        toast.success('Shift updated successfully');
      } else {
        await api.post(`/branches/${currentShiftBranchId}/shifts`, payload);
        toast.success('Shift created successfully');
      }

      setShiftModalOpen(false);
      await fetchBranches();
    } catch (error) {
      console.error('Failed to save shift:', error);
      toast.error(error.response?.data?.message || 'Failed to save shift');
    } finally {
      setShiftSaving(false);
    }
  };

  const deleteShift = async (shiftId) => {
    const confirmed = window.confirm('Delete this shift?');
    if (!confirmed) return;

    try {
      await api.delete(`/branches/shifts/${shiftId}`);
      toast.success('Shift deleted successfully');
      await fetchBranches();
    } catch (error) {
      console.error('Failed to delete shift:', error);
      toast.error(error.response?.data?.message || 'Failed to delete shift');
    }
  };

  const openDeactivateModal = (branch) => {
    setBranchToDeactivate(branch);
    setDeactivateModalOpen(true);
  };

  const deactivateBranch = async () => {
    if (!branchToDeactivate) return;

    setDeactivateLoading(true);
    try {
      await api.delete(`/branches/${branchToDeactivate.id}`);
      toast.success('Branch deactivated successfully');
      setDeactivateModalOpen(false);
      setBranchToDeactivate(null);
      await fetchBranches();
    } catch (error) {
      console.error('Failed to deactivate branch:', error);
      toast.error(error.response?.data?.message || 'Failed to deactivate branch');
    } finally {
      setDeactivateLoading(false);
    }
  };

  const openSetManagerModal = async (branch) => {
    setSetManagerBranch(branch);
    setSetManagerEmployeeId('');
    setSetManagerEmployees([]);
    setSetManagerLoading(true);
    setSetManagerModalOpen(true);
    try {
      const response = await api.get('/employees', { params: { limit: 200, status: 'active' } });
      setSetManagerEmployees(response.data?.employees || []);
    } catch (error) {
      toast.error('Failed to load branch employees');
    } finally {
      setSetManagerLoading(false);
    }
  };

  const saveManager = async () => {
    if (!setManagerEmployeeId) {
      toast.error('Please select an employee');
      return;
    }
    const selected = setManagerEmployees.find((e) => String(e.id) === String(setManagerEmployeeId));
    setSetManagerSaving(true);
    try {
      await api.post(`/branches/${setManagerBranch.id}/set-manager`, {
        employeeId: Number(setManagerEmployeeId),
        employeeName: selected?.name || '',
        branchName: setManagerBranch.name
      });
      toast.success('Manager assignment queued — emails will be sent shortly');
      setSetManagerModalOpen(false);
      await fetchBranches();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign manager');
    } finally {
      setSetManagerSaving(false);
    }
  };

  const shiftColumns = [
    { key: 'name', label: 'Shift Name' },
    {
      key: 'start_time',
      label: 'Start',
      render: (value) => toTimeLabel(value)
    },
    {
      key: 'end_time',
      label: 'End',
      render: (value) => toTimeLabel(value)
    },
    {
      key: 'grace_minutes',
      label: 'Grace Period',
      render: (value) => `${value} min`
    },
    {
      key: 'days_of_week',
      label: 'Working Days',
      render: (value) => toWorkingDaysLabel(value)
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="hr-branch-page__shift-actions">
          <button
            type="button"
            className="hr-branch-page__icon-btn"
            aria-label="Edit shift"
            onClick={() => openEditShiftModal(row.branch_id?.[0] || row.branch_id, row)}
          >
            <EditIcon fontSize="small" />
          </button>
          <button
            type="button"
            className="hr-branch-page__icon-btn hr-branch-page__icon-btn--danger"
            aria-label="Delete shift"
            onClick={() => deleteShift(row.id)}
          >
            <DeleteOutlineIcon fontSize="small" />
          </button>
        </div>
      )
    }
  ];

  return (
    <AppShell pageTitle="Branch Management">
      <div className="hr-branch-page">
        <div className="hr-branch-page__header">
          <h2 className="hr-branch-page__title">Branch Management</h2>
          <Button onClick={openAddBranchModal}>
            <AddIcon fontSize="small" />
            Add Branch
          </Button>
        </div>

        <div className="hr-branch-page__grid">
          {branches.map((branch) => {
            const expanded = !!expandedBranchIds[branch.id];
            const shifts = branch.shifts || [];

            return (
              <Card key={branch.id} className="hr-branch-page__card" hoverable>
                <div className="hr-branch-page__card-content">
                  <div>
                    <h3 className="hr-branch-page__branch-name">{branch.name}</h3>
                    <p className="hr-branch-page__address">{branch.address || 'No address provided'}</p>
                    <p className="hr-branch-page__coords">
                      Lat: {Number(branch.latitude).toFixed(7)}, Lng: {Number(branch.longitude).toFixed(7)}
                    </p>
                  </div>

                  <div className="hr-branch-page__meta-row">
                    <StatusChip status="radius" label={`Radius: ${branch.radius_meters || 200}m`} tone="info" />
                    <StatusChip
                      status={branch.active ? 'active' : 'inactive'}
                      label={branch.active ? 'Active' : 'Inactive'}
                      tone={branch.active ? 'success' : 'neutral'}
                    />
                  </div>

                  <div className="hr-branch-page__employee-count">{branch.employee_count || 0} Employees</div>
                  {branch.storeManager && (
                    <div className="hr-branch-page__store-manager">
                      Store Manager: <span>{branch.storeManager}</span>
                    </div>
                  )}

                  <div className="hr-branch-page__card-footer">
                    <Button size="sm" variant="ghost" onClick={() => openEditBranchModal(branch)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openSetManagerModal(branch)}>
                      Set Manager
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => openDeactivateModal(branch)}>
                      Deactivate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleShifts(branch.id)}>
                      {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      {expanded ? 'Hide Shifts' : 'Show Shifts'}
                    </Button>
                  </div>
                </div>

                {expanded && (
                  <div className="hr-branch-page__shift-section">
                    <DataTable
                      columns={shiftColumns}
                      data={shifts.map((shift) => ({ ...shift, branch_id: shift.branch_id || [branch.id, branch.name] }))}
                      loading={loading}
                      emptyText="No shifts for this branch"
                    />
                    <div className="hr-branch-page__shift-add">
                      <Button size="sm" onClick={() => openAddShiftModal(branch.id)}>
                        <AddIcon fontSize="small" />
                        Add Shift
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <Modal
        open={branchModalOpen}
        onClose={() => setBranchModalOpen(false)}
        title={editingBranch ? 'Edit Branch' : 'Add Branch'}
        maxWidth="640px"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setBranchModalOpen(false)}>Cancel</Button>
            <Button onClick={saveBranch} loading={branchSaving}>Save</Button>
          </>
        )}
      >
        <FormField
          label="Branch Name"
          required
          value={branchForm.name}
          onChange={(event) => setBranchForm((prev) => ({ ...prev, name: event.target.value }))}
        />

        <FormField
          label="Address"
          type="textarea"
          value={branchForm.address}
          onChange={(event) => setBranchForm((prev) => ({ ...prev, address: event.target.value }))}
        />

        <div className="hr-branch-page__form-grid">
          <FormField
            label="Latitude"
            required
            type="number"
            value={branchForm.latitude}
            onChange={(event) => setBranchForm((prev) => ({ ...prev, latitude: event.target.value }))}
          />
          <FormField
            label="Longitude"
            required
            type="number"
            value={branchForm.longitude}
            onChange={(event) => setBranchForm((prev) => ({ ...prev, longitude: event.target.value }))}
          />
        </div>

        <p className="hr-branch-page__helper-text">
          Tip: Open Google Maps, right-click your location, and copy the coordinates shown.
        </p>

        <FormField
          label="Check-in Radius in meters"
          type="number"
          value={branchForm.radius_meters}
          onChange={(event) => setBranchForm((prev) => ({ ...prev, radius_meters: event.target.value }))}
        />
      </Modal>

      <Modal
        open={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        title={editingShift ? 'Edit Shift' : 'Add Shift'}
        maxWidth="640px"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setShiftModalOpen(false)}>Cancel</Button>
            <Button onClick={saveShift} loading={shiftSaving}>Save</Button>
          </>
        )}
      >
        <FormField
          label="Shift Name"
          required
          value={shiftForm.name}
          onChange={(event) => setShiftForm((prev) => ({ ...prev, name: event.target.value }))}
        />

        <div className="hr-branch-page__form-grid">
          <FormField
            label="Start Time"
            required
            type="number"
            value={shiftForm.start_time}
            onChange={(event) => setShiftForm((prev) => ({ ...prev, start_time: event.target.value }))}
          />
          <FormField
            label="End Time"
            required
            type="number"
            value={shiftForm.end_time}
            onChange={(event) => setShiftForm((prev) => ({ ...prev, end_time: event.target.value }))}
          />
        </div>

        <p className="hr-branch-page__helper-text">
          Use 24h decimal format: 9.0 = 9:00am, 13.5 = 1:30pm
        </p>

        <FormField
          label="Grace Period in minutes"
          type="number"
          value={shiftForm.grace_minutes}
          onChange={(event) => setShiftForm((prev) => ({ ...prev, grace_minutes: event.target.value }))}
        />

        <div className="hr-branch-page__days-block">
          <div className="hr-branch-page__days-label">Working Days</div>
          <div className="hr-branch-page__days-grid">
            {DAYS.map((day) => {
              const checked = shiftForm.workingDays.includes(day.value);
              return (
                <label key={day.value} className="hr-branch-page__day-option">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleWorkingDay(day.value)}
                  />
                  <span>{day.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </Modal>

      <Modal
        open={setManagerModalOpen}
        onClose={() => setSetManagerModalOpen(false)}
        title={`Set Manager — ${setManagerBranch?.name || ''}`}
        maxWidth="480px"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setSetManagerModalOpen(false)}>Cancel</Button>
            <Button onClick={saveManager} loading={setManagerSaving}>Assign Manager</Button>
          </>
        )}
      >
        {setManagerBranch?.storeManager && (
          <p className="hr-branch-page__helper-text">
            Current manager: <strong>{setManagerBranch.storeManager}</strong>
          </p>
        )}
        {setManagerLoading ? (
          <p className="hr-branch-page__helper-text">Loading employees…</p>
        ) : setManagerEmployees.length === 0 ? (
          <p className="hr-branch-page__helper-text">No active employees found in this branch.</p>
        ) : (
          <FormField
            label="Select New Manager"
            required
            type="select"
            value={setManagerEmployeeId}
            onChange={(e) => setSetManagerEmployeeId(e.target.value)}
            options={[
              { value: '', label: '— Select employee —' },
              ...setManagerEmployees.map((emp) => ({ value: String(emp.id), label: emp.name }))
            ]}
          />
        )}
        <p className="hr-branch-page__helper-text">
          This will set the selected employee as manager for all staff in this branch and send notification emails.
        </p>
      </Modal>

      <Modal
        open={deactivateModalOpen}
        onClose={() => setDeactivateModalOpen(false)}
        title="Deactivate Branch"
        maxWidth="560px"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDeactivateModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={deactivateBranch} loading={deactivateLoading}>Confirm</Button>
          </>
        )}
      >
        <p className="hr-branch-page__confirm-text">
          Are you sure you want to deactivate {branchToDeactivate?.name || 'this branch'}? Employees assigned to this branch will need to be reassigned before they can check in.
        </p>
      </Modal>
    </AppShell>
  );
}

export default HRBranchManagementPage;
