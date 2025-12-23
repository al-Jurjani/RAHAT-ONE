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
    const ids = await this.execute(model, 'search', [domain, { limit }]);
    if (ids.length === 0) return [];
    return await this.execute(model, 'read', [ids, fields]);
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
    const employees = await this.search(
      'hr.employee',
      [['id', '=', employeeId]],
      ['name', 'work_email', 'department_id', 'job_id', 'onboarding_status', 'onboarding_progress_percentage']
    );
    return employees[0] || null;
  }

  /**
   * Create employee record
   */
  async createEmployee(employeeData) {
    return await this.create('hr.employee', employeeData);
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
}

module.exports = new OdooAdapter();
