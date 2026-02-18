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
          'hr_assigned_department_id',
          'hr_assigned_job_id',
          'parent_id',
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
   * Get latest expense attachment
   */
  async getExpenseAttachment(expenseId) {
    try {
      const parsedExpenseId = Number.parseInt(expenseId, 10);
      if (Number.isNaN(parsedExpenseId)) {
        return null;
      }

      const attachmentIds = await this.execute(
        'ir.attachment',
        'search',
        [[
          ['res_model', '=', 'hr.expense'],
          ['res_id', '=', parsedExpenseId]
        ], 0, 1, 'create_date desc']
      );

      if (attachmentIds.length === 0) {
        return null;
      }

      const attachments = await this.execute(
        'ir.attachment',
        'read',
        [attachmentIds, ['id', 'name', 'mimetype', 'datas']]
      );

      return attachments[0] || null;
    } catch (error) {
      console.error('Odoo getExpenseAttachment Error:', error.message);
      return null;
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
  async updateLeaveStatus(leaveId, action, remarks) {
  const stateMap = {
    'approve': 'validate',    // Final approval
    'validate': 'validate',   // Final approval (alternate)
    'validate1': 'validate1', // Manager approved, pending HR
    'refuse': 'refuse',       // Rejected
    'reject': 'refuse'        // Rejected (alternate)
  };

  const newState = stateMap[action] || action;

  await this.update('hr.leave', leaveId, {
    state: newState
  });

  console.log(`✅ Leave ${leaveId} status updated to: ${newState}`);
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

  /**
   * Post a message/note to a record (using Odoo's chatter system)
   * @param {string} model - Model name (e.g., 'hr.leave')
   * @param {number} recordId - Record ID
   * @param {string} body - Message body (can include HTML)
   * @param {string} messageType - 'comment' or 'notification' (default: 'comment')
   */
  async postMessage(model, recordId, message) {
  try {
    console.log(`📧 Posting message to ${model} #${recordId}`);

    const messageData = {
      model: model,
      res_id: parseInt(recordId),
      body: message,
      message_type: 'comment',
    };

    const messageId = await this.create('mail.message', messageData);

    console.log(`✅ Message posted successfully (ID: ${messageId})`);
    return messageId;
  } catch (error) {
    console.error('❌ Error posting message:', error.message);
    console.warn('⚠️  Continuing without posting message to Odoo chatter');
    return null;
  }
}

  /**
   * Get messages for a record
   * @param {string} model - Model name
   * @param {number} recordId - Record ID
   * @returns {Array} List of messages
   */
  async getMessages(model, recordId) {
    try {
      const messages = await this.search('mail.message',
        [
          ['model', '=', model],
          ['res_id', '=', recordId]
        ],
        ['body', 'date', 'author_id', 'message_type'],
        100
      );
      return messages;
    } catch (error) {
      console.error('❌ Error getting messages:', error);
      throw error;
    }
  }

  // ==========================================
  // EXPENSE MANAGEMENT METHODS
  // ==========================================

  /**
   * Create an expense record
   */
  async createExpense(expenseData) {
    try {
      const nullIfEmpty = (value) => {
        if (value === undefined || value === null || value === '') {
          return null;
        }
        return value;
      };

      const expenseRecord = {
        employee_id: expenseData.employee_id,
        expense_category: expenseData.expense_category,
        total_amount: expenseData.total_amount,
        vendor_name: expenseData.vendor_name,
        date: expenseData.date,
        description: expenseData.description,
        name: expenseData.name || expenseData.description,
        workflow_status: expenseData.workflow_status || 'draft',
        manager_decision: expenseData.manager_decision || 'pending',
        hr_decision: expenseData.hr_decision || 'not_required',
        manager_remarks: expenseData.manager_remarks || '',
        hr_remarks: expenseData.hr_remarks || '',
        approval_token: expenseData.approval_token || null,
        approval_token_expiry: nullIfEmpty(expenseData.approval_token_expiry),
        approval_token_type: expenseData.approval_token_type || 'manager',
        rejection_reason: expenseData.rejection_reason || null,
        rejection_details: expenseData.rejection_details || null,
        submitted_date: nullIfEmpty(expenseData.submitted_date),
        completed_date: nullIfEmpty(expenseData.completed_date)
      };

      // Only include optional fields when explicitly provided
      if (expenseData.policy_check_passed !== undefined) {
        expenseRecord.policy_check_passed = expenseData.policy_check_passed;
      }
      if (expenseData.policy_check_details !== undefined) {
        expenseRecord.policy_check_details = expenseData.policy_check_details;
      }
      if (expenseData.policy_check_date !== undefined) {
        expenseRecord.policy_check_date = nullIfEmpty(expenseData.policy_check_date);
      }
      if (expenseData.document_hash !== undefined) {
        expenseRecord.document_hash = expenseData.document_hash;
      }
      if (expenseData.perceptual_hash !== undefined) {
        expenseRecord.perceptual_hash = expenseData.perceptual_hash;
      }
      if (expenseData.fraud_score !== undefined) {
        expenseRecord.fraud_score = expenseData.fraud_score;
      }
      if (expenseData.fraud_detection_details !== undefined) {
        expenseRecord.fraud_detection_details = expenseData.fraud_detection_details;
      }
      if (expenseData.fraud_detection_status !== undefined) {
        expenseRecord.fraud_detection_status = expenseData.fraud_detection_status;
      }
      if (expenseData.anomaly_confidence !== undefined) {
        expenseRecord.anomaly_confidence = expenseData.anomaly_confidence;
      }
      if (expenseData.manager_approved !== undefined) {
        expenseRecord.manager_approved = expenseData.manager_approved;
      }
      if (expenseData.manager_approved_by !== undefined) {
        expenseRecord.manager_approved_by = expenseData.manager_approved_by;
      }
      if (expenseData.manager_approved_date !== undefined) {
        expenseRecord.manager_approved_date = nullIfEmpty(expenseData.manager_approved_date);
      }
      if (expenseData.hr_escalated !== undefined) {
        expenseRecord.hr_escalated = expenseData.hr_escalated;
      }
      if (expenseData.hr_approved !== undefined) {
        expenseRecord.hr_approved = expenseData.hr_approved;
      }
      if (expenseData.hr_approved_by !== undefined) {
        expenseRecord.hr_approved_by = expenseData.hr_approved_by;
      }
      if (expenseData.hr_approved_date !== undefined) {
        expenseRecord.hr_approved_date = nullIfEmpty(expenseData.hr_approved_date);
      }

      const expenseId = await this.create('hr.expense', expenseRecord);
      console.log('✅ Expense created in Odoo with ID:', expenseId);
      return expenseId;
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  }

  /**
   * Get expense by ID
   */
  async getExpense(expenseId) {
    try {
      const parsedExpenseId = Number.parseInt(expenseId, 10);
      if (Number.isNaN(parsedExpenseId)) {
        return null;
      }

      const expenses = await this.execute('hr.expense', 'read', [
        [parsedExpenseId],
        [
          'id',
          'employee_id',
          'expense_category',
          'total_amount',
          'vendor_name',
          'date',
          'description',
          'name',
          'workflow_status',
          'document_hash',
          'perceptual_hash',
          'fraud_score',
          'fraud_detection_details',
          'fraud_detection_status',
          'anomaly_confidence',
          'manager_approved',
          'manager_approved_by',
          'manager_approved_date',
          'manager_remarks',
          'manager_decision',
          'hr_escalated',
          'hr_approved',
          'hr_approved_by',
          'hr_approved_date',
          'hr_remarks',
          'hr_decision',
          'policy_check_passed',
          'policy_check_details',
          'policy_check_date',
          'approval_token',
          'approval_token_expiry',
          'approval_token_type',
          'submitted_date',
          'completed_date',
          'create_date',
          'write_date'
        ]
      ]);

      return expenses[0] || null;
    } catch (error) {
      console.error('Error getting expense:', error);
      throw error;
    }
  }

  /**
   * Search expenses with filters
   */
  async searchExpenses(filters = {}) {
    try {
      let domain = [];

      // Helper to extract value (handles both arrays and direct values)
      const getValue = (val) => {
        return Array.isArray(val) ? val[0] : val;
      };

      if (filters.employee_id) {
        domain.push(['employee_id', '=', getValue(filters.employee_id)]);
      }

      if (filters.workflow_status) {
        domain.push(['workflow_status', '=', getValue(filters.workflow_status)]);
      }

      if (filters.expense_category) {
        domain.push(['expense_category', '=', getValue(filters.expense_category)]);
      }

      if (filters.vendor_name) {
        domain.push(['vendor_name', 'ilike', getValue(filters.vendor_name)]);
      }

      if (filters.expense_date_from) {
        domain.push(['date', '>=', getValue(filters.expense_date_from)]);
      }

      if (filters.expense_date_to) {
        domain.push(['date', '<=', getValue(filters.expense_date_to)]);
      }

      if (filters.create_date_from) {
        domain.push(['create_date', '>=', getValue(filters.create_date_from)]);
      }

      if (filters.create_date_to) {
        domain.push(['create_date', '<=', getValue(filters.create_date_to)]);
      }

      const expenseIds = await this.execute('hr.expense', 'search', [domain]);

      if (expenseIds.length === 0) {
        return [];
      }

      const expenses = await this.execute('hr.expense', 'read', [
        expenseIds,
        [
          'id',
          'employee_id',
          'expense_category',
          'total_amount',
          'vendor_name',
          'date',
          'description',
          'workflow_status',
          'fraud_score',
          'fraud_detection_status',
          // Detail fields (fraud_detection_details, document_hash, perceptual_hash,
          // anomaly_confidence, clip_embedding, florence_analysis) fetched via getExpense()
          'manager_approved',
          'manager_approved_date',
          'hr_escalated',
          'hr_approved',
          'hr_approved_date',
          'policy_check_passed',
          'approval_token',
          'create_date'
        ]
      ]);

      return expenses;
    } catch (error) {
      console.error('Error searching expenses:', error);
      throw error;
    }
  }

  /**
   * Update expense record
   */
  async updateExpense(expenseId, updateData) {
    try {
      // Parse ID to integer (critical for Odoo)
      const id = parseInt(expenseId, 10);
      if (isNaN(id)) {
        throw new Error(`Invalid expense ID: ${expenseId}`);
      }

      await this.update('hr.expense', id, updateData);
      console.log('✅ Expense updated:', id);
      return true;
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  }

  /**
   * Create attachment for expense
   */
  async createAttachment(resModel, resId, fileName, fileData) {
    try {
      const base64Data = fileData.toString('base64');

      const attachmentId = await this.create('ir.attachment', {
        name: fileName,
        datas: base64Data,
        res_model: resModel,
        res_id: resId,
        type: 'binary',
        mimetype: this.getMimeType(fileName)
      });

      console.log('✅ Attachment created:', attachmentId);
      return attachmentId;
    } catch (error) {
      console.error('Error creating attachment:', error);
      throw error;
    }
  }

  /**
   * Attach file to expense
   */
  async attachFileToExpense(expenseId, attachmentId) {
    try {
      // Link attachment to expense via many2one or computed field
      await this.update('hr.expense', expenseId, {
        attachment_ids: [[4, attachmentId]] // Add to many2many
      });

      console.log('✅ File attached to expense');
      return true;
    } catch (error) {
      console.error('Error attaching file:', error);
      throw error;
    }
  }

  /**
   * Get MIME type from filename
   */
  getMimeType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const mimeTypes = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  // ==========================================
  // FRAUD DETECTION METHODS
  // ==========================================

  /**
   * Get employee's past expenses for fraud detection comparison
   *
   * @param {number} employeeId - Employee ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - List of past expenses with fraud detection data
   */
  async getEmployeePastExpenses(employeeId, options = {}) {
    const {
      fields = [
        'id',
        'name',
        'description',
        'total_amount',
        'document_hash',
        'perceptual_hash',
        'clip_embedding',
        'florence_analysis',
        'fraud_score',
        'create_date'
      ],
      limit = 100
    } = options;

    try {
      console.log(`[FraudDetection] Fetching past expenses for employee ${employeeId}...`);

      // Search for processed expenses by this employee that have been fraud-checked
      const domain = [
        ['employee_id', '=', employeeId],
        ['document_hash', '!=', false]  // Must have been fraud-checked
      ];

      const expenses = await this.search('hr.expense', domain, fields, limit);

      console.log(`[FraudDetection] Found ${expenses.length} past expenses`);
      return expenses;

    } catch (error) {
      console.error('[FraudDetection] Error fetching past expenses:', error.message);
      return [];  // Return empty array on error (fraud detection can continue)
    }
  }

  /**
   * Find expense by MD5 hash (exact duplicate detection)
   *
   * @param {string} md5Hash - MD5 hash of invoice image
   * @returns {Promise<Object|null>} - Matched expense or null
   */
  async findExpenseByMD5(md5Hash) {
    try {
      console.log(`[FraudDetection] Searching for MD5 hash: ${md5Hash}`);

      const domain = [
        ['document_hash', '=', md5Hash]
      ];

      const expenses = await this.search('hr.expense', domain,
        ['id', 'name', 'description', 'employee_id', 'total_amount', 'workflow_status'],
        1
      );

      if (expenses.length > 0) {
        console.log(`[FraudDetection] Found MD5 match: Expense #${expenses[0].id}`);
        return expenses[0];
      }

      return null;

    } catch (error) {
      console.error('[FraudDetection] Error searching MD5:', error.message);
      return null;
    }
  }

  /**
   * Get employee expense statistics for anomaly detection
   *
   * Calculates mean, standard deviation, and count of employee's past expenses
   *
   * @param {number} employeeId - Employee ID
   * @returns {Promise<Object|null>} - Statistics or null if insufficient data
   */
  async getEmployeeExpenseStats(employeeId) {
    try {
      console.log(`[FraudDetection] Calculating expense stats for employee ${employeeId}...`);

      // Fetch all past expenses for this employee
      const domain = [
        ['employee_id', '=', employeeId],
        ['total_amount', '>', 0]  // Only non-zero amounts
      ];

      const expenses = await this.search('hr.expense', domain, ['total_amount'], 500);

      if (expenses.length < 3) {
        console.log(`[FraudDetection] Insufficient data (${expenses.length} expenses)`);
        return null;  // Need at least 3 expenses for meaningful stats
      }

      // Extract amounts
      const amounts = expenses.map(exp => parseFloat(exp.total_amount));

      // Calculate statistics
      const count = amounts.length;
      const mean = amounts.reduce((sum, val) => sum + val, 0) / count;

      // Calculate standard deviation
      const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count;
      const stdDev = Math.sqrt(variance);

      const min = Math.min(...amounts);
      const max = Math.max(...amounts);

      const stats = {
        mean: parseFloat(mean.toFixed(2)),
        stdDev: parseFloat(stdDev.toFixed(2)),
        count,
        min: parseFloat(min.toFixed(2)),
        max: parseFloat(max.toFixed(2))
      };

      console.log(`[FraudDetection] Stats: mean=$${stats.mean}, stdDev=$${stats.stdDev}, count=${count}`);
      return stats;

    } catch (error) {
      console.error('[FraudDetection] Error calculating stats:', error.message);
      return null;
    }
  }

  /**
   * Update expense with fraud detection results
   *
   * @param {number} expenseId - Expense ID
   * @param {Object} fraudResult - Fraud detection result from fraudDetectionService
   * @returns {Promise<boolean>} - Success status
   */
  async updateExpenseWithFraudResult(expenseId, fraudResult) {
    try {
      console.log(`[FraudDetection] Updating expense ${expenseId} with fraud result...`);

      const values = {
        // Store all hashes and embeddings
        document_hash: fraudResult.layers.md5.hash,
        perceptual_hash: fraudResult.layers.pHash.hash,
        clip_embedding: fraudResult.layers.clip.embedding
          ? JSON.stringify(fraudResult.layers.clip.embedding)
          : false,

        // Store Florence-2 analysis
        florence_analysis: fraudResult.layers.florence.analysis || false,

        // Store overall fraud score and status
        fraud_score: fraudResult.overallScore,
        fraud_detection_status: fraudResult.status,  // 'clean', 'suspicious', 'fraudulent'

        // Store detailed layer results (full objects with scores)
        fraud_detection_details: JSON.stringify({
          layers: {
            md5: {
              score: fraudResult.layers.md5.score,
              details: fraudResult.layers.md5.details,
              matched: fraudResult.layers.md5.matched || false,
              matchedExpenseId: fraudResult.layers.md5.matchedExpenseId || null
            },
            pHash: {
              score: fraudResult.layers.pHash.score,
              details: fraudResult.layers.pHash.details,
              similarity: fraudResult.layers.pHash.similarity || 0,
              matched: fraudResult.layers.pHash.matched || false
            },
            clip: {
              score: fraudResult.layers.clip.score,
              details: fraudResult.layers.clip.details,
              similarity: fraudResult.layers.clip.similarity || 0,
              matched: fraudResult.layers.clip.matched || false,
              error: fraudResult.layers.clip.error || false
            },
            florence: {
              score: fraudResult.layers.florence.score,
              details: fraudResult.layers.florence.details,
              flags: fraudResult.layers.florence.flags || [],
              analysis: fraudResult.layers.florence.analysis || null,
              error: fraudResult.layers.florence.error || false
            },
            anomaly: {
              score: fraudResult.layers.anomaly.score,
              details: fraudResult.layers.anomaly.details,
              zScore: fraudResult.layers.anomaly.zScore || null,
              isAnomaly: fraudResult.layers.anomaly.isAnomaly || false
            }
          },
          recommendation: fraudResult.recommendation,
          confidence: fraudResult.confidence,
          processingTime: fraudResult.processingTime,
          timestamp: fraudResult.timestamp
        }),

        // Store anomaly confidence separately for easy filtering
        anomaly_confidence: fraudResult.layers.anomaly.score
      };

      await this.update('hr.expense', expenseId, values);

      console.log(`[FraudDetection] ✅ Expense ${expenseId} updated successfully`);
      return true;

    } catch (error) {
      console.error('[FraudDetection] Error updating expense:', error.message);
      return false;
    }
  }
}

const adapterInstance = new OdooAdapter();

// Auto-authenticate on import
adapterInstance.authenticate()
  .then(() => console.log('✅ Odoo adapter ready'))
  .catch(err => console.error('❌ Odoo connection failed:', err.message));

module.exports = adapterInstance;
