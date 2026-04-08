const odooAdapter = require('../adapters/odooAdapter');
// [n8n-migration] crypto no longer needed — token generation moved to n8n webhook-wait
// const crypto = require('crypto');
const powerAutomateService = require('./powerAutomateService');
// [n8n-migration] Fraud detection now called directly by n8n via Modal HTTP endpoint
// const fraudDetectionService = require('./fraudDetectionService');

class ExpenseService {
  /**
   * Format JS Date to Odoo datetime string (YYYY-MM-DD HH:mm:ss)
   */
  formatOdooDateTime(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
  // [n8n-migration] Policy validation moved to n8n Code node
  // Policy rules for reference:
  //   Category limits (PKR): medical=50000, petrol=10000, travel=75000, other=25000
  //   Frequency: max 5 claims/month per employee
  //   HR escalation: amount > 10000 PKR
  //   Auto-approve: clean fraud + amount <= 10000 PKR
  /*
  async validateExpensePolicy(category, amount, employeeId) {
    const validationResult = {
      passed: true,
      violations: []
    };

    const categoryLimits = {
      medical: 50000,
      petrol: 10000,
      travel: 75000,
      other: 25000
    };

    const normalizedCategory = (category || '').toLowerCase();

    if (categoryLimits[normalizedCategory] && amount > categoryLimits[normalizedCategory]) {
      validationResult.passed = false;
      validationResult.violations.push(
        `Amount (${amount}) exceeds ${category} limit (${categoryLimits[normalizedCategory]})`
      );
    }

    try {
      const currentMonth = new Date();
      currentMonth.setDate(1);

      const monthlyExpenses = await odooAdapter.searchExpenses({
        employee_id: [employeeId],
        create_date_from: currentMonth.toISOString().split('T')[0]
      });

      if (monthlyExpenses.length >= 5) {
        validationResult.passed = false;
        validationResult.violations.push(
          `Exceeded monthly submission limit (5 claims/month). Current: ${monthlyExpenses.length}`
        );
      }
    } catch (err) {
      console.error('Error checking monthly frequency:', err);
    }

    return validationResult;
  }
  */

  // [n8n-migration] Token generation no longer needed — n8n webhook-wait URLs replace tokens
  /*
  generateApprovalToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  getTokenExpiry(daysValid = 7) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + daysValid);
    return this.formatOdooDateTime(expiry);
  }
  */

  /**
   * Submit a new expense (THINNED for n8n migration)
   *
   * Backend is now a trigger layer only:
   * 1. Validate required fields
   * 2. Create hr.expense draft record in Odoo
   * 3. Upload invoice to ir.attachment if present
   * 4. Fire n8n webhook (all orchestration happens there)
   * 5. Return 202
   */
  async submitExpense(employeeId, expenseData, invoiceFile = null) {
    try {
      const categoryMap = {
        Medical: 'medical',
        Petrol: 'petrol',
        Travel: 'travel',
        Other: 'other'
      };

      const normalizedCategory = categoryMap[expenseData.category] || expenseData.category;

      // 1. Validate required fields
      const requiredFields = ['category', 'amount', 'vendor_name', 'expense_date', 'description'];
      const missingFields = requiredFields.filter(field => !expenseData[field]);

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // 2. Create draft expense in Odoo (minimal fields — n8n handles all routing/status)
      const odooExpenseData = {
        employee_id: employeeId,
        expense_category: normalizedCategory,
        total_amount: parseFloat(expenseData.amount),
        vendor_name: expenseData.vendor_name,
        date: expenseData.expense_date,
        description: expenseData.description,
        name: expenseData.description,
        workflow_status: 'draft',
        submitted_date: this.formatOdooDateTime()
      };

      console.log('[ExpenseService] Creating draft expense in Odoo:', odooExpenseData);

      const expenseId = await odooAdapter.createExpense(odooExpenseData);

      if (!expenseId) {
        throw new Error('Failed to create expense in Odoo');
      }

      console.log('[ExpenseService] Expense created with ID:', expenseId);

      // 3. Attach invoice file if provided
      let attachmentId = null;
      if (invoiceFile) {
        try {
          attachmentId = await odooAdapter.createAttachment(
            'hr.expense',
            expenseId,
            invoiceFile.name,
            invoiceFile.data
          );
          console.log('[ExpenseService] Invoice attached, attachment ID:', attachmentId);
        } catch (err) {
          console.error('[ExpenseService] Warning: Could not attach file:', err.message);
        }
      }

      // 4. Get employee + manager details for n8n payload
      const employee = await odooAdapter.getEmployee(employeeId);
      let managerEmail = null;
      if (employee?.parent_id?.[0]) {
        try {
          const manager = await odooAdapter.getEmployee(employee.parent_id[0]);
          managerEmail = manager.work_email || manager.private_email || null;
        } catch (err) {
          console.error('[ExpenseService] Could not fetch manager:', err.message);
        }
      }

      // 5. Fire n8n webhook (fire and forget — all orchestration happens in n8n)
      const n8nPayload = {
        expenseId,
        employeeId,
        employeeName: employee.name,
        employeeEmail: employee.work_email || employee.private_email,
        managerEmail: managerEmail,
        hrEmail: process.env.HR_EMAIL || 'hr@outfitters.com',
        amount: parseFloat(expenseData.amount),
        category: normalizedCategory,
        hasInvoice: !!attachmentId,
        attachmentId: attachmentId,
        submittedAt: new Date().toISOString()
      };

      powerAutomateService.triggerExpenseFlow(n8nPayload).catch(err => {
        console.error('[ExpenseService] n8n webhook fire failed (non-blocking):', err.message);
      });

      // 6. Return 202 — n8n takes over from here
      return {
        success: true,
        expenseId,
        status: 'submitted'
      };
    } catch (error) {
      console.error('Expense submission error:', error);
      throw error;
    }
  }

  // [n8n-migration] Original submitExpense with inline fraud detection, policy check,
  // routing logic, token generation, and Power Automate triggers commented out below.
  // Preserved for reference during n8n flow construction.
  /*
  async submitExpense_ORIGINAL(employeeId, expenseData, invoiceFile = null) {
    try {
      const categoryMap = { Medical: 'medical', Petrol: 'petrol', Travel: 'travel', Other: 'other' };
      const normalizedCategory = categoryMap[expenseData.category] || expenseData.category;

      const requiredFields = ['category', 'amount', 'vendor_name', 'expense_date', 'description'];
      const missingFields = requiredFields.filter(field => !expenseData[field]);
      if (missingFields.length > 0) throw new Error(`Missing required fields: ${missingFields.join(', ')}`);

      // Policy check (now in n8n)
      const policyCheck = await this.validateExpensePolicy(expenseData.category, expenseData.amount, employeeId);

      const odooExpenseData = {
        employee_id: employeeId, expense_category: normalizedCategory,
        total_amount: parseFloat(expenseData.amount), vendor_name: expenseData.vendor_name,
        date: expenseData.expense_date, description: expenseData.description, name: expenseData.description,
        manager_decision: 'pending', hr_decision: 'not_required', manager_remarks: '', hr_remarks: '',
        approval_token: this.generateApprovalToken(), approval_token_expiry: this.getTokenExpiry(),
        approval_token_type: 'manager', rejection_reason: null, rejection_details: null,
        workflow_status: policyCheck.passed ? 'pending_manager' : 'rejected'
      };
      if (policyCheck.passed) odooExpenseData.submitted_date = this.formatOdooDateTime();
      if (policyCheck.passed && expenseData.amount > 10000) {
        odooExpenseData.hr_decision = 'pending'; odooExpenseData.hr_escalated = true;
      }

      const expenseId = await odooAdapter.createExpense(odooExpenseData);
      if (!expenseId) throw new Error('Failed to create expense in Odoo');

      if (invoiceFile) {
        try { await odooAdapter.createAttachment('hr.expense', expenseId, invoiceFile.name, invoiceFile.data); }
        catch (err) { console.error('Warning: Could not attach file:', err.message); }
      }

      // Fraud detection (now in n8n via Modal HTTP call)
      let fraudResult = null;
      if (invoiceFile && policyCheck.passed) {
        try {
          fraudResult = await fraudDetectionService.runFraudDetection(invoiceFile.data, employeeId, parseFloat(expenseData.amount));
          await odooAdapter.updateExpenseWithFraudResult(expenseId, fraudResult);
          const workflowUpdates = {};
          if (fraudResult.status === 'fraudulent') {
            workflowUpdates.hr_escalated = true; workflowUpdates.hr_decision = 'pending';
            workflowUpdates.workflow_status = 'pending_hr'; workflowUpdates.approval_token_type = 'hr';
          } else if (fraudResult.status === 'suspicious') {
            workflowUpdates.hr_escalated = true; workflowUpdates.hr_decision = 'pending';
          }
          if (Object.keys(workflowUpdates).length > 0) await odooAdapter.updateExpense(expenseId, workflowUpdates);
        } catch (fraudError) {
          fraudResult = { status: 'error', overallScore: 0, recommendation: `Fraud detection unavailable: ${fraudError.message}`, error: true };
        }
      }

      // Routing + Power Automate trigger (now in n8n)
      const createdExpense = await odooAdapter.getExpense(expenseId);
      const employee = await odooAdapter.getEmployee(employeeId);
      let manager = null;
      if (employee?.parent_id?.[0]) manager = await odooAdapter.getEmployee(employee.parent_id[0]);

      powerAutomateService.triggerExpensePolicyFlow(
        { expenseId, employeeId, ...expenseData, approval_token: createdExpense.approval_token,
          workflow_status: createdExpense.workflow_status, hr_escalated: createdExpense.hr_escalated || false, fraud: fraudPayload },
        policyCheck, employee, manager
      ).catch(err => console.error('Non-blocking PA error:', err.message));

      return { success: true, expenseId, expense: createdExpense, policyCheckPassed: policyCheck.passed,
        policyViolations: policyCheck.violations, escalatedForHR: createdExpense.hr_escalated || false,
        fraudDetection: fraudResult ? { status: fraudResult.status, score: fraudResult.overallScore } : null,
        message: policyCheck.passed ? 'Expense submitted successfully' : 'Expense rejected due to policy violations'
      };
    } catch (error) { console.error('Expense submission error:', error); throw error; }
  }
  */

  /**
   * Get expense details
   */
  async getExpense(expenseId) {
    try {
      const expense = await odooAdapter.getExpense(expenseId);
      if (!expense) {
        throw new Error('Expense not found');
      }
      return expense;
    } catch (error) {
      console.error('Get expense error:', error);
      throw error;
    }
  }

  /**
   * Get employee's expenses
   */
  async getEmployeeExpenses(employeeId, filters = {}) {
    try {
      const searchFilters = {
        employee_id: [employeeId],
        ...filters
      };
      return await odooAdapter.searchExpenses(searchFilters);
    } catch (error) {
      console.error('Get employee expenses error:', error);
      throw error;
    }
  }

  /**
   * Get expenses for HR approval (all expenses, optionally filtered)
   */
  async getAllExpenses(filters = {}) {
    try {
      return await odooAdapter.searchExpenses(filters);
    } catch (error) {
      console.error('Get all expenses error:', error);
      throw error;
    }
  }

  /**
   * Get pending approval expenses
   */
  async getPendingApprovalExpenses(approvalType = 'manager') {
    try {
      const filters = {};
      if (approvalType === 'manager') {
        filters.workflow_status = 'pending_manager';  // Just the value, not array
      } else if (approvalType === 'hr') {
        filters.workflow_status = 'pending_hr';  // Just the value, not array
      }

      return await odooAdapter.searchExpenses(filters);
    } catch (error) {
      console.error('Get pending expenses error:', error);
      throw error;
    }
  }

  // [n8n-migration] All approval/decision handling moved to n8n flows.
  // Token validation, manager decisions, HR decisions, and escalation
  // are now handled by n8n webhook-wait pattern.
  // Odoo field updates reference (used in n8n flows):
  //   Manager approve: manager_decision='approved', manager_approved=true, manager_approved_date, workflow_status='pending_hr'|'approved'
  //   Manager reject:  manager_decision='rejected', workflow_status='rejected', completed_date
  //   HR approve:      hr_decision='approved', hr_approved=true, hr_approved_date, workflow_status='approved', completed_date
  //   HR reject:       hr_decision='rejected', workflow_status='rejected', completed_date
  /*
  async validateApprovalToken(expenseId, token) {
    try {
      const expense = await odooAdapter.getExpense(expenseId);
      if (!expense) return { valid: false, reason: 'Expense not found' };
      if (expense.approval_token !== token) return { valid: false, reason: 'Invalid token' };
      if (!expense.approval_token_expiry) return { valid: false, reason: 'Token expiry not set' };
      const expiryDate = new Date(expense.approval_token_expiry);
      if (expiryDate < new Date()) return { valid: false, reason: 'Token has expired' };
      return { valid: true, expense };
    } catch (error) { console.error('Token validation error:', error); throw error; }
  }

  async handleManagerDecision(expenseId, decision, managerId, remarks = '') {
    try {
      const expense = await odooAdapter.getExpense(expenseId);
      if (!expense) throw new Error('Expense not found');
      const updateData = {
        manager_approved: decision === 'approve', manager_approved_by: managerId,
        manager_approved_date: this.formatOdooDateTime(), manager_remarks: remarks,
        manager_decision: decision === 'approve' ? 'approved' : 'rejected'
      };
      if (decision === 'approve') {
        if (expense.hr_escalated) {
          updateData.approval_token = this.generateApprovalToken();
          updateData.approval_token_expiry = this.getTokenExpiry();
          updateData.approval_token_type = 'hr'; updateData.workflow_status = 'pending_hr';
        } else { updateData.workflow_status = 'approved'; updateData.completed_date = this.formatOdooDateTime(); }
      } else { updateData.workflow_status = 'rejected'; updateData.completed_date = this.formatOdooDateTime(); }
      await odooAdapter.updateExpense(expenseId, updateData);
      const updatedExpense = await odooAdapter.getExpense(expenseId);
      return { success: true, expense: updatedExpense, nextAction: updatedExpense.workflow_status === 'pending_hr' ? 'hr_approval' : 'none' };
    } catch (error) { console.error('Manager decision error:', error); throw error; }
  }

  async handleHRDecision(expenseId, decision, hrUserId, remarks = '') {
    try {
      const expense = await odooAdapter.getExpense(expenseId);
      if (!expense) throw new Error('Expense not found');
      const updateData = {
        hr_approved: decision === 'approve', hr_approved_by: hrUserId,
        hr_approved_date: this.formatOdooDateTime(), hr_remarks: remarks,
        hr_decision: decision === 'approve' ? 'approved' : 'rejected',
        workflow_status: decision === 'approve' ? 'approved' : 'rejected',
        completed_date: this.formatOdooDateTime()
      };
      await odooAdapter.updateExpense(expenseId, updateData);
      const updatedExpense = await odooAdapter.getExpense(expenseId);
      return { success: true, expense: updatedExpense };
    } catch (error) { console.error('HR decision error:', error); throw error; }
  }

  async escalateToManagerAfterHRApproval(expenseId, hrApprovalToken) {
    // No longer needed — n8n HR decision is final, no second manager pass.
    // If HR approves a fraudulent expense, n8n sends audit email to senior HR (fire-and-forget).
    try {
      const expense = await odooAdapter.getExpense(expenseId);
      if (!expense) throw new Error('Expense not found');
      if (expense.fraud_detection_status !== 'fraudulent') throw new Error('Only for fraudulent expenses');
      if (expense.approval_token !== hrApprovalToken) throw new Error('Invalid HR approval token');
      if (expense.workflow_status !== 'pending_hr') throw new Error('Wrong state');
      const employee = await odooAdapter.getEmployee(expense.employee_id[0]);
      if (!employee.parent_id?.[0]) throw new Error('No manager assigned');
      const manager = await odooAdapter.getEmployee(employee.parent_id[0]);
      const newApprovalToken = this.generateApprovalToken();
      const tokenExpiry = this.getTokenExpiry();
      await odooAdapter.updateExpense(expenseId, {
        workflow_status: 'pending_manager', approval_token: newApprovalToken,
        approval_token_expiry: tokenExpiry, approval_token_type: 'manager',
        hr_approved: true, hr_approved_date: this.formatOdooDateTime(),
        hr_decision: 'approved', manager_decision: 'pending'
      });
      return { success: true, newApprovalToken, managerEmail: manager.work_email || manager.private_email,
        managerName: manager.name, employeeName: employee.name,
        fraudScore: expense.fraud_score, fraudStatus: expense.fraud_detection_status };
    } catch (error) { console.error('Escalate to manager error:', error); throw error; }
  }
  */

  /**
   * Upload file and create Odoo attachment
   */
  async handleFileUpload(expenseId, fileData) {
    try {
      if (!fileData) {
        throw new Error('No file provided');
      }

      console.log('📎 Uploading file:', fileData.name);

      // Create attachment in Odoo
      const attachmentId = await odooAdapter.createAttachment(
        'hr.expense',
        expenseId,
        fileData.name,
        fileData.data
      );

      console.log('✅ File uploaded with attachment ID:', attachmentId);
      return {
        success: true,
        attachmentId,
        fileName: fileData.name
      };
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }
}

module.exports = new ExpenseService();
