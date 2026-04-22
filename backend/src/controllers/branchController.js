const axios = require('axios');
const odooAdapter = require('../adapters/odooAdapter');
const { respondSuccess, respondError } = require('../utils/responseHandler');

const N8N_BRANCH_MANAGER_ASSIGN_WEBHOOK = process.env.N8N_BRANCH_MANAGER_ASSIGN_WEBHOOK || 'http://localhost:5678/webhook/hr-branch-manager-assign';

function toInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

class BranchController {
  async getBranches(req, res) {
    try {
      const branches = await odooAdapter.execute('rahat.branch', 'search_read', [[
        ['active', '=', true]
      ], ['id', 'name', 'address', 'latitude', 'longitude', 'radius_meters', 'active', 'shift_ids', 'employee_count']]);

      const branchIds = branches.map((branch) => branch.id).filter(Boolean);
      let shifts = [];

      if (branchIds.length > 0) {
        shifts = await odooAdapter.execute('rahat.shift', 'search_read', [[
          ['branch_id', 'in', branchIds]
        ], ['id', 'branch_id', 'name', 'start_time', 'end_time', 'grace_minutes', 'days_of_week']]);
      }

      const shiftsByBranch = shifts.reduce((acc, shift) => {
        const branchId = Array.isArray(shift.branch_id) ? shift.branch_id[0] : shift.branch_id;
        if (!acc[branchId]) {
          acc[branchId] = [];
        }
        acc[branchId].push(shift);
        return acc;
      }, {});

      // Detect store manager per branch: employee in the branch who has direct reports
      const branchManagerMap = {};
      if (branchIds.length > 0) {
        const branchEmployees = await odooAdapter.execute('hr.employee', 'search_read', [[
          ['branch_id', 'in', branchIds],
          ['active', '=', true]
        ], ['id', 'name', 'branch_id']]);

        if (branchEmployees.length > 0) {
          const empIds = branchEmployees.map((e) => e.id);
          const reporters = await odooAdapter.execute('hr.employee', 'search_read', [[
            ['parent_id', 'in', empIds],
            ['active', '=', true]
          ], ['parent_id']]);

          const managerIds = new Set(reporters.map((e) => (Array.isArray(e.parent_id) ? e.parent_id[0] : e.parent_id)));

          for (const emp of branchEmployees) {
            if (managerIds.has(emp.id)) {
              const branchId = Array.isArray(emp.branch_id) ? emp.branch_id[0] : emp.branch_id;
              if (branchId && !branchManagerMap[branchId]) {
                branchManagerMap[branchId] = emp.name;
              }
            }
          }
        }
      }

      const data = branches.map((branch) => ({
        ...branch,
        shifts: shiftsByBranch[branch.id] || [],
        storeManager: branchManagerMap[branch.id] || null
      }));

      return respondSuccess(res, data, 'Branches fetched successfully');
    } catch (error) {
      console.error('getBranches error:', error);
      return respondError(res, 'Failed to fetch branches', 500);
    }
  }

  async createBranch(req, res) {
    try {
      const { name, address, latitude, longitude, radius_meters } = req.body;

      if (!name || latitude === undefined || longitude === undefined) {
        return respondError(res, 'name, latitude, and longitude are required', 400);
      }

      const branchId = await odooAdapter.execute('rahat.branch', 'create', [{
        name,
        address: address || false,
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius_meters: radius_meters !== undefined ? toInt(radius_meters) : 200
      }]);

      return respondSuccess(res, { id: branchId }, 'Branch created successfully');
    } catch (error) {
      console.error('createBranch error:', error);
      return respondError(res, 'Failed to create branch', 500);
    }
  }

  async updateBranch(req, res) {
    try {
      const branchId = toInt(req.params.branchId);
      if (!branchId) {
        return respondError(res, 'Invalid branch ID', 400);
      }

      const allowedFields = ['name', 'address', 'latitude', 'longitude', 'radius_meters', 'active'];
      const updates = {};

      allowedFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          updates[field] = req.body[field];
        }
      });

      if (updates.latitude !== undefined) updates.latitude = Number(updates.latitude);
      if (updates.longitude !== undefined) updates.longitude = Number(updates.longitude);
      if (updates.radius_meters !== undefined) updates.radius_meters = toInt(updates.radius_meters);

      if (Object.keys(updates).length === 0) {
        return respondError(res, 'No valid fields provided for update', 400);
      }

      await odooAdapter.execute('rahat.branch', 'write', [[branchId], updates]);
      return respondSuccess(res, { updated: true }, 'Branch updated successfully');
    } catch (error) {
      console.error('updateBranch error:', error);
      return respondError(res, 'Failed to update branch', 500);
    }
  }

  async deleteBranch(req, res) {
    try {
      const branchId = toInt(req.params.branchId);
      if (!branchId) {
        return respondError(res, 'Invalid branch ID', 400);
      }

      await odooAdapter.execute('rahat.branch', 'write', [[branchId], { active: false }]);
      return respondSuccess(res, { deleted: true }, 'Branch deactivated successfully');
    } catch (error) {
      console.error('deleteBranch error:', error);
      return respondError(res, 'Failed to delete branch', 500);
    }
  }

  async getBranchShifts(req, res) {
    try {
      const branchId = toInt(req.params.branchId);
      if (!branchId) {
        return respondError(res, 'Invalid branch ID', 400);
      }

      const shifts = await odooAdapter.execute('rahat.shift', 'search_read', [[
        ['branch_id', '=', branchId]
      ], ['id', 'name', 'start_time', 'end_time', 'grace_minutes', 'days_of_week']]);

      return respondSuccess(res, shifts, 'Branch shifts fetched successfully');
    } catch (error) {
      console.error('getBranchShifts error:', error);
      return respondError(res, 'Failed to fetch branch shifts', 500);
    }
  }

  async createShift(req, res) {
    try {
      const branchId = toInt(req.params.branchId);
      if (!branchId) {
        return respondError(res, 'Invalid branch ID', 400);
      }

      const { name, start_time, end_time, grace_minutes, days_of_week } = req.body;
      if (!name || start_time === undefined || end_time === undefined) {
        return respondError(res, 'name, start_time, and end_time are required', 400);
      }

      const shiftId = await odooAdapter.execute('rahat.shift', 'create', [{
        branch_id: branchId,
        name,
        start_time: Number(start_time),
        end_time: Number(end_time),
        grace_minutes: grace_minutes !== undefined ? toInt(grace_minutes) : 15,
        days_of_week: days_of_week || '0,1,2,3,4'
      }]);

      return respondSuccess(res, { id: shiftId }, 'Shift created successfully');
    } catch (error) {
      console.error('createShift error:', error);
      return respondError(res, 'Failed to create shift', 500);
    }
  }

  async updateShift(req, res) {
    try {
      const shiftId = toInt(req.params.shiftId);
      if (!shiftId) {
        return respondError(res, 'Invalid shift ID', 400);
      }

      const allowedFields = ['name', 'start_time', 'end_time', 'grace_minutes', 'days_of_week', 'branch_id'];
      const updates = {};

      allowedFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          updates[field] = req.body[field];
        }
      });

      if (updates.start_time !== undefined) updates.start_time = Number(updates.start_time);
      if (updates.end_time !== undefined) updates.end_time = Number(updates.end_time);
      if (updates.grace_minutes !== undefined) updates.grace_minutes = toInt(updates.grace_minutes);
      if (updates.branch_id !== undefined) updates.branch_id = toInt(updates.branch_id);

      if (Object.keys(updates).length === 0) {
        return respondError(res, 'No valid fields provided for update', 400);
      }

      await odooAdapter.execute('rahat.shift', 'write', [[shiftId], updates]);
      return respondSuccess(res, { updated: true }, 'Shift updated successfully');
    } catch (error) {
      console.error('updateShift error:', error);
      return respondError(res, 'Failed to update shift', 500);
    }
  }

  async deleteShift(req, res) {
    try {
      const shiftId = toInt(req.params.shiftId);
      if (!shiftId) {
        return respondError(res, 'Invalid shift ID', 400);
      }

      await odooAdapter.execute('rahat.shift', 'unlink', [[shiftId]]);
      return respondSuccess(res, { deleted: true }, 'Shift deleted successfully');
    } catch (error) {
      console.error('deleteShift error:', error);
      return respondError(res, 'Failed to delete shift', 500);
    }
  }

  async setManager(req, res) {
    try {
      const branchId = toInt(req.params.branchId);
      const employeeId = toInt(req.body.employeeId);
      const branchName = req.body.branchName || '';
      const employeeName = req.body.employeeName || '';

      if (!branchId) return respondError(res, 'Invalid branch ID', 400);
      if (!employeeId) return respondError(res, 'employeeId is required', 400);

      const triggeredBy = req.user?.name || req.user?.email || 'HR';

      axios.post(N8N_BRANCH_MANAGER_ASSIGN_WEBHOOK, {
        branchId,
        branchName,
        newManagerEmployeeId: employeeId,
        newManagerName: employeeName,
        triggeredBy,
        triggeredByRole: req.user?.role || 'hr',
        requestedAt: new Date().toISOString()
      }).then(() => {
        console.log('[Branch] Manager assign webhook fired for branch', branchId, '→ employee', employeeId);
      }).catch((err) => {
        console.error('[Branch] Manager assign webhook error:', err.message);
      });

      return respondSuccess(res, { queued: true }, 'Manager assignment queued successfully');
    } catch (error) {
      console.error('setManager error:', error);
      return respondError(res, 'Failed to queue manager assignment', 500);
    }
  }
}

module.exports = new BranchController();
