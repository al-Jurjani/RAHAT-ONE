const xmlrpc = require('xmlrpc');
const axios = require('axios');
const odooConfig = require('../../config/odoo.config');

class OdooAdapter {
  constructor() {
    this.url = odooConfig.url;
    this.db = odooConfig.db;
    this.username = odooConfig.username;
    this.password = odooConfig.password;
    this.uid = null;
    this.sessionId = null;
  }

  /**
   * Authenticate with Odoo and get user ID
   */
  async authenticate() {
    try {
      const commonClient = xmlrpc.createClient({
        host: new URL(this.url).hostname,
        port: new URL(this.url).port || 8069,
        path: '/xmlrpc/2/common'
      });

      return new Promise((resolve, reject) => {
        commonClient.methodCall('authenticate', [
          this.db,
          this.username,
          this.password,
          {}
        ], (error, uid) => {
          if (error) {
            console.error('Odoo Authentication Error:', error);
            reject(error);
          } else {
            this.uid = uid;
            console.log('Odoo authenticated successfully. UID:', uid);
            resolve(uid);
          }
        });
      });
    } catch (error) {
      console.error('Authentication failed:', error.message);
      throw new Error('Failed to authenticate with Odoo');
    }
  }

  /**
   * Execute a method on Odoo model
   */
  async execute(model, method, params = []) {
    if (!this.uid) {
      await this.authenticate();
    }

    const objectClient = xmlrpc.createClient({
      host: new URL(this.url).hostname,
      port: new URL(this.url).port || 8069,
      path: '/xmlrpc/2/object'
    });

    return new Promise((resolve, reject) => {
      objectClient.methodCall('execute_kw', [
        this.db,
        this.uid,
        this.password,
        model,
        method,
        params
      ], (error, result) => {
        if (error) {
          console.error(`Odoo ${method} Error:`, error);
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Search for records
   */
  async search(model, domain = [], fields = [], limit = 100) {
    try {
      // First, search for IDs only
      const ids = await this.execute(model, 'search', [domain, 0, limit, false]);

      if (!ids || ids.length === 0) {
        return [];
      }

      // Then read the records with specified fields
      return await this.execute(model, 'read', [ids, fields]);
    } catch (error) {
      console.error(`❌ Search error on ${model}:`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   */
  async create(model, values) {
    return await this.execute(model, 'create', [values]);
  }

  /**
   * Update existing record
   */
  async update(model, id, values) {
    return await this.execute(model, 'write', [[id], values]);
  }

  /**
   * Get employee by ID
   */
  async getEmployee(employeeId) {
    try {
      const employees = await this.execute('hr.employee', 'read', [
        [employeeId],
        [
          'name',
          'work_email',
          'private_email',
          'department_id',
          'job_id',
          'onboarding_status',
          'onboarding_progress_percentage',
          'mobile_phone',
          'birthday',
          'entered_cnic_number',
          'entered_father_name',
          'extracted_name',
          'extracted_cnic_number',
          'extracted_father_name',
          'extracted_dob',
          'ocr_confidence',
          'ai_verification_status',
          'ai_verification_score',
          'ai_verification_details',
          'ai_verification_date',
          'hr_verification_status',
          'hr_verification_notes',
          'hr_verified_by',
          'hr_verified_date',
          'rejection_reason',
          'rejection_details',
          'create_date',
          'cnic_uploaded',
          'degree_uploaded',
          'medical_uploaded'
        ]
      ]);

      return employees[0] || null;
    } catch (error) {
      console.error('❌ Error getting employee:', error);
      throw error;
    }
  }

  /**
   * Create employee record
   */
  async createEmployee(employeeData) {
    return await this.create('hr.employee', employeeData);
  }

  /**
 * Update employee record
 */
async updateEmployee(employeeId, data) {
  try {
    // CRITICAL: Ensure ID is integer, not string
    const id = parseInt(employeeId);

    console.log(`📝 Updating employee ${id} with data:`, Object.keys(data));

    const result = await this.execute(
      'hr.employee',
      'write',
      [[id], data]  // Must be [id] as integer inside array
    );

    console.log('✅ Employee updated successfully');
    return result;

  } catch (error) {
    console.error('Odoo write Error:', error);
    throw error;
  }
}

  /**
   * Upload file to Odoo as attachment
   */
  async uploadAttachment(fileName, fileData, resModel, resId) {
    try {
      const base64Data = fileData.toString('base64');

      const attachmentId = await this.create('ir.attachment', {
        name: fileName,
        datas: base64Data,
        res_model: resModel,
        res_id: resId,
        type: 'binary'
      });

      console.log('File uploaded to Odoo. Attachment ID:', attachmentId);
      return attachmentId;
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  /**
   * Upload document to Odoo
   */
  async uploadDocument(fileBuffer, fileName, resModel, resId, description = '') {
    return await this.uploadAttachment(fileName, fileBuffer, resModel, resId);
  }

  /**
   * Get employee documents (attachments)
   */
  /**
 * Get employee documents (attachments)
 */
async getEmployeeDocuments(employeeId) {
  try {
    // Search for attachments linked to this employee
    const attachmentIds = await this.execute(
      'ir.attachment',
      'search',
      [[
        ['res_model', '=', 'hr.employee'],
        ['res_id', '=', employeeId]
      ]]
    );

    if (attachmentIds.length === 0) {
      return [];
    }

    // Read attachment details with correct field names for Odoo 17
    const attachments = await this.execute(
      'ir.attachment',
      'read',
      [attachmentIds, ['id', 'name', 'mimetype', 'create_date', 'datas', 'checksum']]
    );

    return attachments;

  } catch (error) {
    console.error('Odoo getEmployeeDocuments Error:', error.message);
    return [];
  }
}

  /**
   * Search employees with domain filters
   */
  async searchEmployees(domain) {
    const employeeIds = await this.execute(
      'hr.employee',
      'search',
      [domain]
    );

    return employeeIds;
  }

  /**
   * Search and read employees with filters and options
   */
  async searchAndReadEmployees(domain = [], options = {}) {
    try {
      const fields = [
        'id', 'name', 'work_email', 'private_email', 'mobile_phone',
        'department_id', 'job_id', 'onboarding_status',
        'ai_verification_status', 'ai_verification_score',
        'hr_verification_status', 'onboarding_initiated_date',
        'hr_verified_date', 'rejection_date', 'rejection_reason',
        'cnic_uploaded', 'degree_uploaded', 'medical_uploaded',
        'entered_cnic_number', 'entered_father_name', 'active'
      ];

      // If we need to include inactive records, modify the domain
      let searchDomain = domain;
      if (options.includeInactive) {
        // Add explicit check for both active and inactive records using OR
        searchDomain = ['|', ['active', '=', true], ['active', '=', false], ...domain];
      }

      // Search for IDs with optional ordering and limit
      let searchParams = [searchDomain];

      if (options.limit) {
        searchParams.push(0); // offset
        searchParams.push(options.limit); // limit

        if (options.order) {
          searchParams.push(options.order); // order by
        }
      }

      const employeeIds = await this.execute(
        'hr.employee',
        'search',
        searchParams
      );

      if (!employeeIds || employeeIds.length === 0) {
        return [];
      }

      // Read the records with specified fields
      const employees = await this.execute(
        'hr.employee',
        'read',
        [employeeIds, fields]
      );

      return employees || [];

    } catch (error) {
      console.error('Odoo searchAndReadEmployees Error:', error);
      throw error;
    }
  }


  /**
   * Get all departments
   */
  async getDepartments() {
    const departmentIds = await this.execute(
      'hr.department',
      'search',
      [[]]
    );

    if (departmentIds.length === 0) return [];

    const departments = await this.execute(
      'hr.department',
      'read',
      [departmentIds, ['name']]
    );

    return departments.map(dept => ({
      id: dept.id,
      name: dept.name
    }));
  }

  /**
   * Get all job positions
   */
  async getAllJobPositions() {
    const jobIds = await this.execute(
      'hr.job',
      'search',
      [[]]
    );

    if (jobIds.length === 0) return [];

    const jobs = await this.execute(
      'hr.job',
      'read',
      [jobIds, ['name', 'department_id']]
    );

    return jobs.map(job => ({
      id: job.id,
      name: job.name,
      departmentId: job.department_id?.[0] || null,
      departmentName: job.department_id?.[1] || ''
    }));
  }

  /**
   * Get job positions by department
   */
  async getJobPositionsByDepartment(departmentId) {
    const jobIds = await this.execute(
      'hr.job',
      'search',
      [[['department_id', '=', departmentId]]]
    );

    if (jobIds.length === 0) return [];

    const jobs = await this.execute(
      'hr.job',
      'read',
      [jobIds, ['name', 'department_id']]
    );

    return jobs.map(job => ({
      id: job.id,
      name: job.name,
      departmentId: job.department_id?.[0],
      departmentName: job.department_id?.[1]
    }));
  }

  // ==========================================
  // LEAVE MANAGEMENT METHODS
  // ==========================================

  /**
 * Get leave balance for an employee
 */
async getLeaveBalance(employeeId, leaveTypeId = null) {
  try {
    console.log(`🔍 [getLeaveBalance] employeeId=${employeeId}, leaveTypeId=${leaveTypeId}`);

    if (!this.uid) {
      await this.authenticate();
    }

    // Resolve leave type if not provided
    if (!leaveTypeId) {
      const objectClient = xmlrpc.createClient({
        host: new URL(this.url).hostname,
        port: new URL(this.url).port || 8069,
        path: '/xmlrpc/2/object'
      });

      const leaveTypes = await new Promise((resolve, reject) => {
        objectClient.methodCall('execute_kw', [
          this.db,
          this.uid,
          this.password,
          'hr.leave.type',
          'search_read',
          [[['name', '=', 'Annual Leave']], ['id']]
        ], (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      if (!leaveTypes.length) {
        throw new Error('Annual Leave type not found');
      }
      leaveTypeId = leaveTypes[0].id;
    }

    console.log(`   → Direct XML-RPC call for allocations: employee=${employeeId}, type=${leaveTypeId}`);

    // DIRECT XML-RPC CALL - No wrapper
    const objectClient = xmlrpc.createClient({
      host: new URL(this.url).hostname,
      port: new URL(this.url).port || 8069,
      path: '/xmlrpc/2/object'
    });

    const allocations = await new Promise((resolve, reject) => {
      objectClient.methodCall('execute_kw', [
        this.db,
        this.uid,
        this.password,
        'hr.leave.allocation',
        'search_read',
        [
          [
            ['employee_id', '=', parseInt(employeeId)],
            ['holiday_status_id', '=', parseInt(leaveTypeId)],
            ['state', '=', 'validate']
          ],
          ['id', 'employee_id', 'holiday_status_id', 'number_of_days', 'state']
        ]
      ], (error, result) => {
        if (error) {
          console.error('   ❌ Allocation search failed:', error);
          reject(error);
        } else {
          console.log('   ✅ Allocations:', JSON.stringify(result, null, 2));
          resolve(result);
        }
      });
    });

    const totalDays = allocations.reduce((sum, a) => sum + (a.number_of_days || 0), 0);

    // Get leaves
    const leaves = await new Promise((resolve, reject) => {
      objectClient.methodCall('execute_kw', [
        this.db,
        this.uid,
        this.password,
        'hr.leave',
        'search_read',
        [
          [
            ['employee_id', '=', parseInt(employeeId)],
            ['holiday_status_id', '=', parseInt(leaveTypeId)],
            ['state', '=', 'validate']
          ],
          ['id', 'number_of_days']
        ]
      ], (error, result) => {
        if (error) {
          console.error('   ❌ Leaves search failed:', error);
          reject(error);
        } else {
          console.log('   ✅ Leaves:', JSON.stringify(result, null, 2));
          resolve(result);
        }
      });
    });

    const usedDays = leaves.reduce((sum, l) => sum + (l.number_of_days || 0), 0);

    const result = {
      total: totalDays,
      used: usedDays,
      remaining: totalDays - usedDays
    };

    console.log(`   ✅ FINAL: ${JSON.stringify(result)}`);
    return result;

  } catch (error) {
    console.error('❌ getLeaveBalance error:', error);
    throw error;
  }
}


  /**
   * Get all leave types
   * @returns {Array} List of leave types
   */
  async getLeaveTypes() {
    try {
      return await this.search('hr.leave.type',
        [['active', '=', true]],
        ['name', 'requires_allocation', 'color']
      );
    } catch (error) {
      console.error('Error getting leave types:', error);
      throw error;
    }
  }

  /**
   * Create a new leave request
   * @param {Object} leaveData - Leave request data
   * @returns {number} Created leave ID
   */
  async createLeaveRequest(leaveData) {
    try {
      const leaveRecord = {
        employee_id: leaveData.employee_id,
        holiday_status_id: leaveData.leave_type_id,
        request_date_from: leaveData.date_from,
        request_date_to: leaveData.date_to,
        number_of_days: leaveData.number_of_days,
        name: leaveData.notes || 'Leave Request',
        state: 'confirm', // Pending approval
      };

      return await this.create('hr.leave', leaveRecord);
    } catch (error) {
      console.error('Error creating leave request:', error);
      throw error;
    }
  }

  /**
   * Get leave requests with optional filters
   * @param {Object} filters - Filter criteria
   * @returns {Array} List of leave requests
   */
  async getLeaveRequests(filters = {}) {
    try {
      let domain = [];

      if (filters.state) {
        domain.push(['state', '=', filters.state]);
      }

      if (filters.employee_id) {
        domain.push(['employee_id', '=', filters.employee_id]);
      }

      const leaves = await this.search('hr.leave', domain, [
      'employee_id',
      'holiday_status_id',
      'request_date_from',
      'request_date_to',
      'number_of_days',
      'state',
      'name',
      'create_date'
    ], 1000);

    // Fetch employee emails
    for (let leave of leaves) {
      if (leave.employee_id && leave.employee_id[0]) {
        try {
          const employee = await this.execute('hr.employee', 'read', [
            [leave.employee_id[0]],
            ['work_email']
          ]);
          leave.employee_email = employee[0]?.work_email || 'N/A';
        } catch (err) {
          leave.employee_email = 'N/A';
        }
      }
    }

    // Sort by create_date descending (latest first)
    leaves.sort((a, b) => new Date(b.create_date) - new Date(a.create_date));

    console.log(`✅ Fetched ${leaves.length} leaves (sorted by latest first)`);
    return leaves;
    } catch (error) {
      console.error('Error getting leave requests:', error);
      throw error;
    }
  }

  /**
   * Update leave status (approve/reject)
   * @param {number} leaveId - Leave request ID
   * @param {string} action - 'approve' or 'reject'
   * @param {string} remarks - Optional remarks
   * @returns {boolean} Success status
   */
  async updateLeaveStatus(leaveId, action, remarks = '') {
    try {
      const newState = action === 'approve' ? 'validate' : 'refuse';

      // Update the state using the update method (which calls 'write')
      await this.update('hr.leave', leaveId, { state: newState });

      // If there are remarks, update the name field
      if (remarks) {
        await this.update('hr.leave', leaveId, {
          name: remarks
        });
      }

      return true;
    } catch (error) {
      console.error('Error updating leave status:', error);
      throw error;
    }
  }

  /**
   * Get leave request by ID
   * @param {number} leaveId - Leave request ID
   * @returns {Object} Leave request details
   */
  async getLeaveById(leaveId) {
    try {
      const leaves = await this.search('hr.leave',
        [['id', '=', leaveId]],
        [
          'employee_id',
          'holiday_status_id',
          'request_date_from',
          'request_date_to',
          'number_of_days',
          'state',
          'name',
          'create_date'
        ]
      );

      return leaves.length > 0 ? leaves[0] : null;
    } catch (error) {
      console.error('Error getting leave by ID:', error);
      throw error;
    }
  }

  /**
   * Check if employee has sufficient leave balance
   * @param {number} employeeId - Employee ID
   * @param {number} leaveTypeId - Leave type ID
   * @param {number} requestedDays - Number of days requested
   * @returns {Object} { sufficient, balance }
   */
  async checkLeaveBalance(employeeId, leaveTypeId, requestedDays) {
    try {
      const balance = await this.getLeaveBalance(employeeId, leaveTypeId);

      return {
        sufficient: balance.remaining >= requestedDays,
        balance: balance
      };
    } catch (error) {
      console.error('Error checking leave balance:', error);
      throw error;
    }
  }

}

const adapterInstance = new OdooAdapter();

// Auto-authenticate on import
adapterInstance.authenticate()
  .then(() => console.log('✅ Odoo adapter ready'))
  .catch(err => console.error('❌ Odoo connection failed:', err.message));

module.exports = adapterInstance;
