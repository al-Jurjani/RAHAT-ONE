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
}

const adapterInstance = new OdooAdapter();

// Auto-authenticate on import
adapterInstance.authenticate()
  .then(() => console.log('✅ Odoo adapter ready'))
  .catch(err => console.error('❌ Odoo connection failed:', err.message));

module.exports = adapterInstance;
