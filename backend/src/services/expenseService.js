const odooAdapter = require('../adapters/odooAdapter');
const crypto = require('crypto');
const powerAutomateService = require('./powerAutomateService');
const fraudDetectionService = require('./fraudDetectionService');

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
  /**
   * Validate expense against policy rules
   */
  async validateExpensePolicy(category, amount, employeeId) {
    const validationResult = {
      passed: true,
      violations: []
    };

    // Category limits (in PKR)
    const categoryLimits = {
      medical: 50000,
      petrol: 10000,
      travel: 75000,
      other: 25000
    };

    const normalizedCategory = (category || '').toLowerCase();

    // Check category limit
    if (categoryLimits[normalizedCategory] && amount > categoryLimits[normalizedCategory]) {
      validationResult.passed = false;
      validationResult.violations.push(
        `Amount (${amount}) exceeds ${category} limit (${categoryLimits[normalizedCategory]})`
      );
    }

    // Check monthly expense frequency (max 5 claims/month)
    try {
      const currentMonth = new Date();
      currentMonth.setDate(1); // First day of month

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
      // Don't fail on this check - log but continue
    }

    return validationResult;
  }

  /**
   * Generate approval token for secure email links
   */
  generateApprovalToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Set token expiry (default: 7 days)
   */
  getTokenExpiry(daysValid = 7) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + daysValid);
    return this.formatOdooDateTime(expiry);
  }

  /**
   * Submit a new expense
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

      // 2. Validate policy
      const policyCheck = await this.validateExpensePolicy(
        expenseData.category,
        expenseData.amount,
        employeeId
      );

      // 3. Prepare Odoo expense data
      // ONLY include writable fields (not readonly)
      const odooExpenseData = {
        // Core fields (required and writable)
        employee_id: employeeId,
        expense_category: normalizedCategory,
        total_amount: parseFloat(expenseData.amount),
        vendor_name: expenseData.vendor_name,
        date: expenseData.expense_date,
        description: expenseData.description,
        name: expenseData.description,
        // Manager/HR decision (writable)
        manager_decision: 'pending',
        hr_decision: 'not_required',
        manager_remarks: '',
        hr_remarks: '',
        // Approval tokens (writable)
        approval_token: this.generateApprovalToken(),
        approval_token_expiry: this.getTokenExpiry(),
        approval_token_type: 'manager',
        // Rejection fields (writable, but not needed yet)
        rejection_reason: null,
        rejection_details: null,
        // Status
        workflow_status: policyCheck.passed ? 'pending_manager' : 'rejected'
      };

      // Add dates only if policy passed (for successful submission)
      if (policyCheck.passed) {
        odooExpenseData.submitted_date = this.formatOdooDateTime();
      }

      // Check if escalation needed (> 10k PKR)
      if (policyCheck.passed && expenseData.amount > 10000) {
        odooExpenseData.hr_decision = 'pending';
        odooExpenseData.hr_escalated = true;  // Flag for HR escalation
      }

      console.log('📝 Creating expense in Odoo:', odooExpenseData);

      // 4. Create expense in Odoo
      const expenseId = await odooAdapter.createExpense(odooExpenseData);

      if (!expenseId) {
        throw new Error('Failed to create expense in Odoo');
      }

      console.log('✅ Expense created in Odoo with ID:', expenseId);

      // 5. Attach file if provided
      if (invoiceFile) {
        try {
          await odooAdapter.createAttachment(
            'hr.expense',
            expenseId,
            invoiceFile.name,
            invoiceFile.data
          );
          console.log('📎 File attached to expense');
        } catch (err) {
          console.error('⚠️  Warning: Could not attach file:', err.message);
          // Don't fail if attachment fails
        }
      }

      // 6. Run fraud detection if invoice file is provided
      let fraudResult = null;
      if (invoiceFile && policyCheck.passed) {
        try {
          console.log('🔍 Running fraud detection...');

          // Run fraud detection pipeline
          fraudResult = await fraudDetectionService.runFraudDetection(
            invoiceFile.data, // Buffer
            employeeId,
            parseFloat(expenseData.amount)
          );

          console.log(`🔍 Fraud detection complete: ${fraudResult.status} (score: ${fraudResult.overallScore.toFixed(3)})`);

          // Update expense with fraud detection results
          await odooAdapter.updateExpenseWithFraudResult(expenseId, fraudResult);

          // Adjust workflow based on fraud status
          const workflowUpdates = {};

          if (fraudResult.status === 'fraudulent') {
            // Fraudulent: Auto-escalate to HR for review (Option A)
            console.log('⚠️  FRAUDULENT expense detected - escalating to HR');
            workflowUpdates.hr_escalated = true;
            workflowUpdates.hr_decision = 'pending';
            workflowUpdates.workflow_status = 'pending_hr'; // Skip manager, go straight to HR
            workflowUpdates.manager_decision = 'auto_escalated'; // Mark as auto-escalated
            workflowUpdates.approval_token_type = 'hr'; // Token for HR approval

          } else if (fraudResult.status === 'suspicious') {
            // Suspicious: Flag for HR review but follow normal flow
            console.log('⚠️  SUSPICIOUS expense detected - flagging for HR review');
            workflowUpdates.hr_escalated = true;
            workflowUpdates.hr_decision = 'pending';
            // Keep workflow_status as 'pending_manager' - manager reviews first, then HR
          }

          // Apply workflow updates if needed
          if (Object.keys(workflowUpdates).length > 0) {
            await odooAdapter.updateExpense(expenseId, workflowUpdates);
          }

        } catch (fraudError) {
          console.error('⚠️  Fraud detection failed (non-blocking):', fraudError.message);
          // Don't fail expense submission if fraud detection fails
          // Continue with normal workflow
          fraudResult = {
            status: 'error',
            overallScore: 0,
            recommendation: `Fraud detection unavailable: ${fraudError.message}`,
            error: true
          };
        }
      } else if (!invoiceFile && policyCheck.passed) {
        console.log('⚠️  No invoice file provided - skipping fraud detection');
      }

      // 7. Get created expense details (after fraud detection updates)
      const createdExpense = await odooAdapter.getExpense(expenseId);

      // 8. Trigger Power Automate flow with fraud detection results
      try {
        // Get employee details
        const employee = await odooAdapter.getEmployee(employeeId);

        // Get manager details if available
        let manager = null;
        if (employee?.parent_id?.[0]) {
          manager = await odooAdapter.getEmployee(employee.parent_id[0]);
        }

        // Prepare fraud detection payload
        const fraudPayload = fraudResult ? {
          fraudDetected: fraudResult.status !== 'clean',
          fraudStatus: fraudResult.status, // 'clean', 'suspicious', 'fraudulent', 'error'
          fraudScore: fraudResult.overallScore,
          fraudConfidence: fraudResult.confidence || 0,
          fraudRecommendation: fraudResult.recommendation,
          fraudLayers: fraudResult.layers ? {
            md5Match: fraudResult.layers.md5?.matched || false,
            pHashSimilarity: fraudResult.layers.pHash?.similarity || 0,
            clipSimilarity: fraudResult.layers.clip?.similarity || 0,
            florenceFraudScore: fraudResult.layers.florence?.score || 0,
            anomalyZScore: fraudResult.layers.anomaly?.zScore || null
          } : null,
          fraudProcessingTime: fraudResult.processingTime || 0
        } : {
          fraudDetected: false,
          fraudStatus: invoiceFile ? 'not_run' : 'no_invoice',
          fraudScore: 0,
          fraudRecommendation: invoiceFile ? 'Fraud detection not run' : 'No invoice file provided'
        };

        // Trigger flow (fire and forget)
        powerAutomateService.triggerExpensePolicyFlow(
          {
            expenseId,
            employeeId,
            ...expenseData,
            approval_token: createdExpense.approval_token,
            workflow_status: createdExpense.workflow_status,
            hr_escalated: createdExpense.hr_escalated || false,
            fraud: fraudPayload
          },
          policyCheck,
          employee,
          manager
        ).catch(err => {
          console.error('⚠️  Non-blocking Power Automate error:', err.message);
        });
      } catch (err) {
        console.error('⚠️  Could not trigger Power Automate flow:', err.message);
      }

      return {
        success: true,
        expenseId,
        expense: createdExpense,
        policyCheckPassed: policyCheck.passed,
        policyViolations: policyCheck.violations,
        escalatedForHR: createdExpense.hr_escalated || false,
        fraudDetection: fraudResult ? {
          status: fraudResult.status,
          score: fraudResult.overallScore,
          confidence: fraudResult.confidence || 0,
          recommendation: fraudResult.recommendation,
          processingTime: fraudResult.processingTime
        } : null,
        message: policyCheck.passed
          ? (fraudResult?.status === 'fraudulent'
              ? 'Expense submitted but flagged as fraudulent - escalated to HR'
              : fraudResult?.status === 'suspicious'
                ? 'Expense submitted but flagged as suspicious - will require HR review'
                : 'Expense submitted successfully')
          : 'Expense rejected due to policy violations'
      };
    } catch (error) {
      console.error('Expense submission error:', error);
      throw error;
    }
  }

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

  /**
   * Validate approval token
   */
  async validateApprovalToken(expenseId, token) {
    try {
      const expense = await odooAdapter.getExpense(expenseId);

      if (!expense) {
        return { valid: false, reason: 'Expense not found' };
      }

      if (expense.approval_token !== token) {
        return { valid: false, reason: 'Invalid token' };
      }

      if (!expense.approval_token_expiry) {
        return { valid: false, reason: 'Token expiry not set' };
      }

      const expiryDate = new Date(expense.approval_token_expiry);
      if (expiryDate < new Date()) {
        return { valid: false, reason: 'Token has expired' };
      }

      return { valid: true, expense };
    } catch (error) {
      console.error('Token validation error:', error);
      throw error;
    }
  }

  /**
   * Manager approval/rejection
   */
  async handleManagerDecision(expenseId, decision, managerId, remarks = '') {
    try {
      const expense = await odooAdapter.getExpense(expenseId);

      if (!expense) {
        throw new Error('Expense not found');
      }

      const updateData = {
        manager_approved: decision === 'approve',
        manager_approved_by: managerId,
        manager_approved_date: this.formatOdooDateTime(),
        manager_remarks: remarks,
        manager_decision: decision === 'approve' ? 'approved' : 'rejected'
      };

      if (decision === 'approve') {
        if (expense.hr_escalated) {
          // Generate new token for HR approval
          updateData.approval_token = this.generateApprovalToken();
          updateData.approval_token_expiry = this.getTokenExpiry();
          updateData.approval_token_type = 'hr';
          updateData.workflow_status = 'pending_hr';
        } else {
          updateData.workflow_status = 'approved';
          updateData.completed_date = this.formatOdooDateTime();
        }
      } else if (decision === 'reject') {
        updateData.workflow_status = 'rejected';
        updateData.completed_date = this.formatOdooDateTime();
      }

      console.log('📝 Updating expense with manager decision:', updateData);
      await odooAdapter.updateExpense(expenseId, updateData);

      const updatedExpense = await odooAdapter.getExpense(expenseId);
      return {
        success: true,
        expense: updatedExpense,
        nextAction: updatedExpense.workflow_status === 'pending_hr' ? 'hr_approval' : 'none'
      };
    } catch (error) {
      console.error('Manager decision error:', error);
      throw error;
    }
  }

  /**
   * HR approval/rejection
   */
  async handleHRDecision(expenseId, decision, hrUserId, remarks = '') {
    try {
      const expense = await odooAdapter.getExpense(expenseId);

      if (!expense) {
        throw new Error('Expense not found');
      }

      const updateData = {
        hr_approved: decision === 'approve',
        hr_approved_by: hrUserId,
        hr_approved_date: this.formatOdooDateTime(),
        hr_remarks: remarks,
        hr_decision: decision === 'approve' ? 'approved' : 'rejected',
        workflow_status: decision === 'approve' ? 'approved' : 'rejected',
        completed_date: this.formatOdooDateTime()
      };

      console.log('📝 Updating expense with HR decision:', updateData);
      await odooAdapter.updateExpense(expenseId, updateData);

      const updatedExpense = await odooAdapter.getExpense(expenseId);
      return {
        success: true,
        expense: updatedExpense
      };
    } catch (error) {
      console.error('HR decision error:', error);
      throw error;
    }
  }

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
