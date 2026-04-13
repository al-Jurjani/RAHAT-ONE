const odooAdapter = require('../adapters/odooAdapter');
const { respondSuccess, respondError } = require('../utils/responseHandler');

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

class EmployeeController {
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
        'emergency_phone'
      ];

      const fields = pickExistingFields(fieldMap, requestedFields);
      const employee = await readEmployeeWithFields(employeeId, fields);

      if (!employee) {
        return respondError(res, 'Employee not found', 404);
      }

      const manager = normalizeMany2one(employee.parent_id);
      const department = normalizeMany2one(employee.department_id);
      const job = normalizeMany2one(employee.job_id);

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
