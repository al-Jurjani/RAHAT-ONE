const odooAdapter = require('../adapters/odooAdapter');
const { respondSuccess, respondError } = require('../utils/responseHandler');
const powerAutomateService = require('../services/powerAutomateService');

const EMPLOYEE_MODEL = 'hr.employee';

function toInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function sameEmployeeOrHR(req, targetEmployeeId) {
  return req.user?.role === 'hr' || req.user?.employee_id === targetEmployeeId;
}

async function getEmployeeFieldMap() {
  const fieldMap = await odooAdapter.execute(EMPLOYEE_MODEL, 'fields_get', [[], ['type']]);
  return fieldMap || {};
}

function pickExistingFields(fieldMap, candidates) {
  return candidates.filter((fieldName) => Boolean(fieldMap[fieldName]));
}

async function readEmployeeWithFields(employeeId, fields) {
  const result = await odooAdapter.execute(EMPLOYEE_MODEL, 'read', [[employeeId], fields]);
  return result && result[0] ? result[0] : null;
}

function normalizeMany2one(value) {
  if (!value || !Array.isArray(value)) {
    return null;
  }
  return {
    id: value[0],
    name: value[1]
  };
}

function fieldValue(record, field) {
  return record && Object.prototype.hasOwnProperty.call(record, field) ? record[field] : null;
}

function parseStatus(status) {
  if (!status) return true;
  return String(status).toLowerCase() !== 'inactive';
}

class EmployeeController {
  async listEmployees(req, res) {
    try {
      const {
        department,
        jobTitle,
        search,
        status = 'active',
        branchId,
        limit = '50',
        offset = '0'
      } = req.query;

      const parsedLimit = Math.max(1, Math.min(toInt(limit) || 50, 200));
      const parsedOffset = Math.max(0, toInt(offset) || 0);
      const parsedDepartment = toInt(department);
      const parsedBranchId = toInt(branchId);

      const domain = [
        ['active', '=', parseStatus(status)]
      ];

      if (parsedDepartment) {
        domain.push(['department_id', '=', parsedDepartment]);
      }

      if (jobTitle) {
        domain.push(['job_title', 'ilike', String(jobTitle)]);
      }

      if (search) {
        domain.push(['name', 'ilike', String(search)]);
      }

      if (parsedBranchId) {
        domain.push(['branch_id', '=', parsedBranchId]);
      }

      const fields = [
        'id',
        'name',
        'job_title',
        'department_id',
        'parent_id',
        'work_email',
        'mobile_phone',
        'image_128',
        'active',
        'branch_id',
        'shift_id',
        'create_date'
      ];

      const [employees, total] = await Promise.all([
        odooAdapter.execute('hr.employee', 'search_read', [domain, fields, parsedOffset, parsedLimit, 'id desc']),
        odooAdapter.execute('hr.employee', 'search_count', [domain])
      ]);

      return res.status(200).json({
        employees: employees || [],
        total: total || 0,
        limit: parsedLimit,
        offset: parsedOffset
      });
    } catch (error) {
      console.error('listEmployees error:', error);
      return respondError(res, 'Failed to fetch employees', 500);
    }
  }

  async getEmployeeById(req, res) {
    try {
      const employeeId = toInt(req.params.employeeId);
      if (!employeeId) {
        return respondError(res, 'Invalid employee ID', 400);
      }

      const fields = [
        'id',
        'name',
        'job_title',
        'department_id',
        'parent_id',
        'work_email',
        'mobile_phone',
        'image_128',
        'active',
        'branch_id',
        'shift_id',
        'create_date',
        'image_512',
        'private_email',
        'emergency_contact',
        'emergency_phone',
        'gender',
        'birthday',
        'country_id',
        'employee_type',
        'company_id'
      ];

      const records = await odooAdapter.execute('hr.employee', 'search_read', [
        [['id', '=', employeeId]],
        fields,
        0,
        1,
        'id desc'
      ]);

      if (!records || records.length === 0) {
        return respondError(res, 'Employee not found', 404);
      }

      return res.status(200).json(records[0]);
    } catch (error) {
      console.error('getEmployeeById error:', error);
      return respondError(res, 'Failed to fetch employee profile', 500);
    }
  }

  async updateEmployeeBranch(req, res) {
    try {
      const employeeId = toInt(req.params.employeeId);
      const branchId = toInt(req.body.branchId);
      const shiftId = req.body.shiftId !== undefined && req.body.shiftId !== null
        ? toInt(req.body.shiftId)
        : null;

      if (!employeeId) {
        return respondError(res, 'Invalid employee ID', 400);
      }

      if (!branchId) {
        return respondError(res, 'branchId is required', 400);
      }

      const payload = {
        employeeId,
        branchId,
        shiftId,
        triggeredBy: req.user?.name || req.user?.email || 'HR',
        triggeredByRole: req.user?.role || 'hr',
        requestedAt: new Date().toISOString()
      };

      const triggered = await powerAutomateService.triggerHrBranchShiftAssignment(payload);
      if (!triggered) {
        return respondError(res, 'Failed to trigger branch/shift assignment workflow', 502);
      }

      return res.status(202).json({
        success: true,
        message: 'Branch/shift assignment accepted and handed off to workflow.',
        employeeId,
        branchId,
        shiftId: shiftId || null
      });
    } catch (error) {
      console.error('updateEmployeeBranch error:', error);
      return respondError(res, 'Failed to update employee branch', 500);
    }
  }

  async updateEmployeeManager(req, res) {
    try {
      const employeeId = toInt(req.params.employeeId);
      const managerId = toInt(req.body.managerId);

      if (!employeeId) {
        return respondError(res, 'Invalid employee ID', 400);
      }

      if (!managerId) {
        return respondError(res, 'managerId is required', 400);
      }

      await odooAdapter.execute('hr.employee', 'write', [[employeeId], {
        parent_id: managerId
      }]);

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('updateEmployeeManager error:', error);
      return respondError(res, 'Failed to update employee manager', 500);
    }
  }

  async getProfile(req, res) {
    try {
      const employeeId = toInt(req.params.employeeId);
      if (!employeeId) {
        return respondError(res, 'Invalid employee ID', 400);
      }

      if (!sameEmployeeOrHR(req, employeeId)) {
        return respondError(res, 'Forbidden', 403);
      }

      const fieldMap = await getEmployeeFieldMap();
      const requestedFields = [
        'id',
        'name',
        'job_title',
        'job_id',
        'department_id',
        'parent_id',
        'work_email',
        'private_email',
        'mobile_phone',
        'create_date',
        'image_1920',
        'onboarding_progress_percentage',
        'employee_id',
        'identification_id',
        'emergency_contact_name',
        'emergency_contact_phone',
        'emergency_contact',
        'emergency_phone',
        'branch_id',
        'shift_id'
      ];

      const fields = pickExistingFields(fieldMap, requestedFields);
      const employee = await readEmployeeWithFields(employeeId, fields);

      if (!employee) {
        return respondError(res, 'Employee not found', 404);
      }

      const manager = normalizeMany2one(employee.parent_id);
      const department = normalizeMany2one(employee.department_id);
      const job = normalizeMany2one(employee.job_id);
      const branch = normalizeMany2one(employee.branch_id);
      const shift = normalizeMany2one(employee.shift_id);
      let shiftDetails = shift;

      if (shift?.id) {
        const shiftRecords = await odooAdapter.execute('rahat.shift', 'read', [[shift.id], [
          'id',
          'name',
          'start_time',
          'end_time',
          'grace_minutes',
          'days_of_week'
        ]]);

        if (shiftRecords && shiftRecords[0]) {
          const shiftRecord = shiftRecords[0];
          shiftDetails = {
            ...shift,
            start_time: shiftRecord.start_time ?? null,
            end_time: shiftRecord.end_time ?? null,
            grace_minutes: shiftRecord.grace_minutes ?? null,
            days_of_week: shiftRecord.days_of_week ?? null
          };
        }
      }

      const emergencyContactName =
        fieldValue(employee, 'emergency_contact_name') ||
        fieldValue(employee, 'emergency_contact') ||
        null;

      const emergencyContactPhone =
        fieldValue(employee, 'emergency_contact_phone') ||
        fieldValue(employee, 'emergency_phone') ||
        null;

      const photoBase64 = fieldValue(employee, 'image_1920');
      const photoDataUri = photoBase64 ? `data:image/png;base64,${photoBase64}` : null;

      const profile = {
        id: employee.id,
        employeeId: fieldValue(employee, 'employee_id') || fieldValue(employee, 'identification_id') || String(employee.id),
        name: employee.name || '',
        jobTitle: fieldValue(employee, 'job_title') || (job ? job.name : null),
        department,
        manager,
        branch,
        shift: shiftDetails,
        workEmail: fieldValue(employee, 'work_email'),
        personalEmail: fieldValue(employee, 'private_email'),
        personalPhone: fieldValue(employee, 'mobile_phone'),
        joinDate: fieldValue(employee, 'create_date'),
        onboardingCompletion: fieldValue(employee, 'onboarding_progress_percentage'),
        emergencyContactName,
        emergencyContactPhone,
        photoDataUri,
        photoUrl: photoDataUri ? null : `/api/employee/profile/${employeeId}/photo`
      };

      return respondSuccess(res, profile, 'Employee profile fetched');
    } catch (error) {
      console.error('getProfile error:', error);
      return respondError(res, 'Failed to fetch employee profile', 500);
    }
  }

  async updateProfile(req, res) {
    try {
      const employeeId = toInt(req.params.employeeId);
      if (!employeeId) {
        return respondError(res, 'Invalid employee ID', 400);
      }

      if (!sameEmployeeOrHR(req, employeeId)) {
        return respondError(res, 'Forbidden', 403);
      }

      const fieldMap = await getEmployeeFieldMap();
      const updates = {};

      if (typeof req.body.mobile_phone === 'string' && fieldMap.mobile_phone) {
        updates.mobile_phone = req.body.mobile_phone;
      }
      if (typeof req.body.private_email === 'string' && fieldMap.private_email) {
        updates.private_email = req.body.private_email;
      }

      const emergencyName = typeof req.body.emergency_contact_name === 'string'
        ? req.body.emergency_contact_name
        : (typeof req.body.emergency_contact === 'string' ? req.body.emergency_contact : null);

      const emergencyPhone = typeof req.body.emergency_contact_phone === 'string'
        ? req.body.emergency_contact_phone
        : (typeof req.body.emergency_phone === 'string' ? req.body.emergency_phone : null);

      if (emergencyName !== null) {
        if (fieldMap.emergency_contact_name) {
          updates.emergency_contact_name = emergencyName;
        } else if (fieldMap.emergency_contact) {
          updates.emergency_contact = emergencyName;
        }
      }

      if (emergencyPhone !== null) {
        if (fieldMap.emergency_contact_phone) {
          updates.emergency_contact_phone = emergencyPhone;
        } else if (fieldMap.emergency_phone) {
          updates.emergency_phone = emergencyPhone;
        }
      }

      if (Object.keys(updates).length === 0) {
        return respondError(res, 'No supported fields provided for update', 400);
      }

      await odooAdapter.execute(EMPLOYEE_MODEL, 'write', [[employeeId], updates]);
      return respondSuccess(res, { updated: true }, 'Profile updated successfully');
    } catch (error) {
      console.error('updateProfile error:', error);
      return respondError(res, 'Failed to update profile', 500);
    }
  }

  async uploadProfilePhoto(req, res) {
    try {
      const employeeId = toInt(req.params.employeeId);
      if (!employeeId) {
        return respondError(res, 'Invalid employee ID', 400);
      }

      if (!sameEmployeeOrHR(req, employeeId)) {
        return respondError(res, 'Forbidden', 403);
      }

      const photoFile = req.files?.photo;
      if (!photoFile) {
        return respondError(res, 'Photo file is required', 400);
      }

      const attachmentId = await odooAdapter.createAttachment(
        EMPLOYEE_MODEL,
        employeeId,
        photoFile.name,
        photoFile.data
      );

      const fieldMap = await getEmployeeFieldMap();
      if (fieldMap.image_1920) {
        await odooAdapter.execute(EMPLOYEE_MODEL, 'write', [[employeeId], {
          image_1920: photoFile.data.toString('base64')
        }]);
      }

      return respondSuccess(res, {
        attachmentId,
        photoUrl: `/api/employee/profile/${employeeId}/photo?ts=${Date.now()}`
      }, 'Photo uploaded successfully');
    } catch (error) {
      console.error('uploadProfilePhoto error:', error);
      return respondError(res, 'Failed to upload photo', 500);
    }
  }

  async getProfilePhoto(req, res) {
    try {
      const employeeId = toInt(req.params.employeeId);
      if (!employeeId) {
        return respondError(res, 'Invalid employee ID', 400);
      }

      if (!sameEmployeeOrHR(req, employeeId)) {
        return respondError(res, 'Forbidden', 403);
      }

      const fieldMap = await getEmployeeFieldMap();
      if (fieldMap.image_1920) {
        const employee = await readEmployeeWithFields(employeeId, ['image_1920']);
        if (employee?.image_1920) {
          const buffer = Buffer.from(employee.image_1920, 'base64');
          res.setHeader('Content-Type', 'image/png');
          return res.status(200).send(buffer);
        }
      }

      const attachmentIds = await odooAdapter.execute('ir.attachment', 'search', [[
        ['res_model', '=', EMPLOYEE_MODEL],
        ['res_id', '=', employeeId],
        ['mimetype', 'ilike', 'image/']
      ], 0, 1, 'create_date desc']);

      if (!attachmentIds || attachmentIds.length === 0) {
        return respondError(res, 'Photo not found', 404);
      }

      const attachments = await odooAdapter.execute('ir.attachment', 'read', [attachmentIds, ['datas', 'mimetype']]);
      const attachment = attachments && attachments[0] ? attachments[0] : null;
      if (!attachment?.datas) {
        return respondError(res, 'Photo not found', 404);
      }

      const buffer = Buffer.from(attachment.datas, 'base64');
      res.setHeader('Content-Type', attachment.mimetype || 'image/png');
      return res.status(200).send(buffer);
    } catch (error) {
      console.error('getProfilePhoto error:', error);
      return respondError(res, 'Failed to fetch photo', 500);
    }
  }

  async getLeaveSummary(req, res) {
    try {
      const employeeId = toInt(req.params.employeeId);
      if (!employeeId) {
        return respondError(res, 'Invalid employee ID', 400);
      }

      if (!sameEmployeeOrHR(req, employeeId)) {
        return respondError(res, 'Forbidden', 403);
      }

      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
      const yearEnd = new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10);

      const allocations = await odooAdapter.execute('hr.leave.allocation', 'search_read', [[
        ['employee_id', '=', employeeId],
        ['state', '=', 'validate']
      ], ['number_of_days']]);

      const leavesThisYear = await odooAdapter.execute('hr.leave', 'search_read', [[
        ['employee_id', '=', employeeId],
        ['state', '=', 'validate'],
        ['request_date_from', '>=', yearStart],
        ['request_date_from', '<=', yearEnd]
      ], ['number_of_days']]);

      const pendingLeaves = await odooAdapter.execute('hr.leave', 'search_count', [[
        ['employee_id', '=', employeeId],
        ['state', 'in', ['confirm', 'validate1']]
      ]]);

      const totalAllocated = allocations.reduce((sum, row) => sum + (row.number_of_days || 0), 0);
      const approvedLeaveDaysThisYear = leavesThisYear.reduce((sum, row) => sum + (row.number_of_days || 0), 0);
      const approvedLeaveCountThisYear = leavesThisYear.length;

      return respondSuccess(res, {
        leaveBalance: Math.max(totalAllocated - approvedLeaveDaysThisYear, 0),
        leavesTakenThisYear: approvedLeaveCountThisYear,
        pendingLeaves
      }, 'Leave summary fetched');
    } catch (error) {
      console.error('getLeaveSummary error:', error);
      return respondError(res, 'Failed to fetch leave summary', 500);
    }
  }

  async getExpenseSummary(req, res) {
    try {
      const employeeId = toInt(req.params.employeeId);
      if (!employeeId) {
        return respondError(res, 'Invalid employee ID', 400);
      }

      if (!sameEmployeeOrHR(req, employeeId)) {
        return respondError(res, 'Forbidden', 403);
      }

      const pendingExpenseClaims = await odooAdapter.execute('hr.expense', 'search_count', [[
        ['employee_id', '=', employeeId],
        ['workflow_status', 'in', ['draft', 'pending_manager', 'pending_hr', 'pending_manager_approval', 'pending_hr_approval', 'submitted', 'in_review']]
      ]]);

      return respondSuccess(res, {
        pendingExpenseClaims
      }, 'Expense summary fetched');
    } catch (error) {
      console.error('getExpenseSummary error:', error);
      return respondError(res, 'Failed to fetch expense summary', 500);
    }
  }
}

module.exports = new EmployeeController();
