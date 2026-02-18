const expenseService = require('../services/expenseService');
const powerAutomateService = require('../services/powerAutomateService');
const odooAdapter = require('../adapters/odooAdapter');
const { respondSuccess, respondError } = require('../utils/responseHandler');

class ExpenseController {
  /**
   * POST /api/expenses/submit
   * Submit a new expense (requires authentication)
   */
  async submitExpense(req, res) {
    try {
      const employeeId = req.user.employee_id;
      const expenseData = req.body;
      let invoiceFile = null;

      console.log('📝 Expense submission received');
      console.log('   Employee ID:', employeeId);
      console.log('   Expense Data:', expenseData);

      // Validate required fields
      const requiredFields = ['category', 'amount', 'vendor_name', 'expense_date', 'description'];
      const missingFields = requiredFields.filter(field => !expenseData[field]);

      if (missingFields.length > 0) {
        return respondError(res, `Missing required fields: ${missingFields.join(', ')}`, 400);
      }

      // Get employee details
      const employee = await odooAdapter.getEmployee(employeeId);
      if (!employee) {
        return respondError(res, 'Employee not found', 404);
      }

      console.log('   Employee details:', employee.name, employee.work_email);

      // Handle file upload if present
      if (req.files && req.files.invoice) {
        invoiceFile = req.files.invoice;
      }

      // Submit expense
      const result = await expenseService.submitExpense(employeeId, expenseData, invoiceFile);

      // Prepare Power Automate payload
      let managerEmail = null;
      let managerName = null;

      if (employee.parent_id && employee.parent_id[0]) {
        try {
          const manager = await odooAdapter.getEmployee(employee.parent_id[0]);
          managerEmail = manager.work_email || manager.private_email || 'sigh.and.wave@gmail.com';
          managerName = manager.name;
          console.log('   Manager details:', managerName, managerEmail);
        } catch (err) {
          console.error('   ⚠️  Could not fetch manager details:', err.message);
          managerEmail = 'sigh.and.wave@gmail.com';
        }
      }

      // Power Automate flow is now triggered directly from expenseService.submitExpense()
      // No need to trigger it here anymore

      return respondSuccess(res, {
        expenseId: result.expenseId,
        status: result.expense.workflow_status,
        message: result.message,
        policyViolations: result.policyViolations,
        escalatedForHR: result.escalatedForHR,
        fraudDetection: result.fraudDetection
      }, 'Expense submitted successfully');

    } catch (error) {
      console.error('Expense submission error:', error);
      return respondError(res, error.message, 500);
    }
  }

  /**
   * GET /api/expenses
   * List expenses (filtered by role)
   */
  async listExpenses(req, res) {
    try {
      const { status, category, dateFrom, dateTo, vendor } = req.query;
      const employeeId = req.user.employee_id;
      const userRole = req.user.role; // Should be set in authMiddleware

      console.log('📋 Expense list request');
      console.log('   User Role:', userRole);
      console.log('   Filters:', { status, category, dateFrom, dateTo, vendor });

      let expenses = [];
      const filters = {};

      // Add filter parameters if provided
      if (status) filters.workflow_status = ['=', status];
      if (category) filters.expense_category = ['=', category.toLowerCase()];
      if (vendor) filters.vendor_name = ['ilike', vendor];

      // Date range filtering
      if (dateFrom) {
        filters.create_date_from = dateFrom;
      }
      if (dateTo) {
        filters.create_date_to = dateTo;
      }

      // Filter by role
      if (userRole === 'hr' || userRole === 'manager') {
        // HR and managers see all expenses
        expenses = await expenseService.getAllExpenses(filters);
        console.log('   HR/Manager view - Total expenses:', expenses.length);
      } else {
        // Employees see only their own expenses
        filters.employee_id = [employeeId];
        expenses = await expenseService.getEmployeeExpenses(employeeId, filters);
        console.log('   Employee view - Total expenses:', expenses.length);
      }

      return respondSuccess(res, {
        count: expenses.length,
        expenses
      }, 'Expenses fetched successfully');

    } catch (error) {
      console.error('List expenses error:', error);
      return respondError(res, error.message, 500);
    }
  }

  /**
   * GET /api/expenses/:id
   * Get expense details (authenticated)
   */
  async getExpenseDetails(req, res) {
    try {
      const { id } = req.params;
      const employeeId = req.user.employee_id;
      const userRole = req.user.role;

      console.log('📄 Get expense details:', id);

      const expense = await expenseService.getExpense(id);

      if (!expense) {
        return respondError(res, 'Expense not found', 404);
      }

      // Authorization check: employee can only see their own, HR/manager can see all
      if (userRole !== 'hr' && userRole !== 'manager' && expense.employee_id[0] !== employeeId) {
        return respondError(res, 'You do not have permission to view this expense', 403);
      }

      return respondSuccess(res, expense, 'Expense details fetched successfully');

    } catch (error) {
      console.error('Get expense details error:', error);
      return respondError(res, error.message, 500);
    }
  }

  /**
   * GET /api/expenses/:id/attachment
   * Get expense attachment (authenticated)
   */
  async getExpenseAttachment(req, res) {
    try {
      const { id } = req.params;
      const employeeId = req.user.employee_id;
      const userRole = req.user.role;

      const expense = await expenseService.getExpense(id);

      if (!expense) {
        return respondError(res, 'Expense not found', 404);
      }

      if (userRole !== 'hr' && userRole !== 'manager' && expense.employee_id[0] !== employeeId) {
        return respondError(res, 'You do not have permission to view this attachment', 403);
      }

      const attachment = await odooAdapter.getExpenseAttachment(id);

      if (!attachment || !attachment.datas) {
        return respondError(res, 'Attachment not found', 404);
      }

      const fileBuffer = Buffer.from(attachment.datas, 'base64');
      const fileName = (attachment.name || `expense-${id}`).replace(/"/g, '');

      res.setHeader('Content-Type', attachment.mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.status(200).send(fileBuffer);

    } catch (error) {
      console.error('Get expense attachment error:', error);
      return respondError(res, error.message, 500);
    }
  }

  /**
   * GET /api/expenses/public/:expenseId
   * Public endpoint for approval page (token-based, no auth required)
   */
  async getExpenseForApproval(req, res) {
    try {
      const { expenseId } = req.params;
      const { token } = req.query;

      console.log('🔓 Public expense view request:', expenseId);

      if (!token) {
        return respondError(res, 'Approval token required', 400);
      }

      // Validate token
      const tokenValidation = await expenseService.validateApprovalToken(expenseId, token);

      if (!tokenValidation.valid) {
        return respondError(res, tokenValidation.reason, 401);
      }

      const expense = tokenValidation.expense;

      // Get employee details
      const employee = await odooAdapter.getEmployee(expense.employee_id[0]);

      return respondSuccess(res, {
        expense,
        employee: {
          id: employee.id,
          name: employee.name,
          email: employee.work_email
        }
      }, 'Expense fetched successfully');

    } catch (error) {
      console.error('Get expense for approval error:', error);
      return respondError(res, error.message, 500);
    }
  }

  /**
   * GET /api/expenses/public/:expenseId/invoice
   * Public endpoint for viewing invoice (token-based, no auth required)
   */
  async getPublicInvoicePreview(req, res) {
    try {
      const { expenseId } = req.params;
      const { token } = req.query;

      console.log('🔓 Public invoice preview request:', expenseId);

      if (!token) {
        return respondError(res, 'Approval token required', 400);
      }

      // Validate token
      const tokenValidation = await expenseService.validateApprovalToken(expenseId, token);

      if (!tokenValidation.valid) {
        return respondError(res, tokenValidation.reason, 401);
      }

      // Get attachment
      const attachment = await odooAdapter.getExpenseAttachment(expenseId);

      if (!attachment || !attachment.datas) {
        return respondError(res, 'Invoice not found or not yet uploaded', 404);
      }

      const fileBuffer = Buffer.from(attachment.datas, 'base64');
      const fileName = (attachment.name || `expense-${expenseId}-invoice`).replace(/"/g, '');

      res.setHeader('Content-Type', attachment.mimetype || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.status(200).send(fileBuffer);

    } catch (error) {
      console.error('Get public invoice preview error:', error);
      return respondError(res, error.message, 500);
    }
  }

  /**
   * POST /api/expenses/:expenseId/manager-decision
   * Public endpoint for manager to approve/reject
   */
  async handleManagerDecision(req, res) {
    try {
      const { expenseId } = req.params;
      const { token, decision, remarks } = req.body;

      console.log('👤 Manager decision received:', { expenseId, decision });
      console.log('   Full request body:', JSON.stringify(req.body));
      console.log('   Token provided:', token ? `${token.substring(0, 10)}...` : 'MISSING');

      if (!token || !decision) {
        console.log('   ❌ Missing token or decision');
        return respondError(res, 'Token and decision are required', 400);
      }

      if (!['approve', 'reject'].includes(decision)) {
        console.log('   ❌ Invalid decision value:', decision);
        return respondError(res, 'Decision must be "approve" or "reject"', 400);
      }

      // Validate token
      const tokenValidation = await expenseService.validateApprovalToken(expenseId, token);
      if (!tokenValidation.valid) {
        console.log('   ❌ Token validation failed:', tokenValidation.reason);
        return respondError(res, tokenValidation.reason, 401);
      }

      const expense = tokenValidation.expense;
      console.log('   Expense current status:', expense.workflow_status, '| hr_escalated:', expense.hr_escalated);

      // Verify expense is awaiting manager approval
      if (expense.workflow_status !== 'pending_manager') {
        console.log('   ❌ Wrong state:', expense.workflow_status);
        return respondError(res, `Expense is in "${expense.workflow_status}" state, cannot process manager decision`, 400);
      }

      // Get manager ID from expense (assume manager made request) - in real scenario, verify from email/session
      const managerId = expense.employee_id[0]?.parent_id?.[0] || null;

      // Process decision
      const result = await expenseService.handleManagerDecision(
        expenseId,
        decision,
        managerId,
        remarks || ''
      );

      // Trigger Power Automate for decision notification
      const employee = await odooAdapter.getEmployee(result.expense.employee_id[0]);

      // Get manager details for Flow 2 (needed for fraudulent expense escalation)
      let manager = null;
      if (employee.parent_id && employee.parent_id[0]) {
        try {
          manager = await odooAdapter.getEmployee(employee.parent_id[0]);
        } catch (err) {
          console.error('⚠️  Could not fetch manager details:', err.message);
        }
      }

      const payloadForPA = {
        expenseId: parseInt(expenseId, 10),  // Parse to integer
        decision,
        approverType: 'manager',
        employeeId: parseInt(result.expense.employee_id[0], 10),  // Parse to integer
        employeeName: employee.name,
        employeeEmail: employee.work_email,
        amount: parseFloat(result.expense.total_amount),  // Parse to number
        category: result.expense.expense_category,
        remarks: remarks || '',
        nextStage: result.nextAction === 'hr_approval' ? 'Pending HR Approval' : 'Completed',
        hrEscalated: result.expense.hr_escalated || false,
        approvalToken: result.expense.approval_token || null,
        workflowStatus: result.expense.workflow_status,
        processedAt: new Date().toISOString(),
        backendUrl: process.env.BACKEND_URL || 'http://localhost:5000',
        fraudDetectionStatus: result.expense.fraud_detection_status || 'not_run',
        managerEmail: manager ? (manager.work_email || manager.private_email) : null,
        managerName: manager ? manager.name : null
      };

      powerAutomateService.triggerApprovalResponseFlow(payloadForPA).catch(err => {
        console.error('⚠️  Power Automate decision notification failed:', err.message);
      });

      return respondSuccess(res, {
        success: true,
        expenseId,
        decision,
        message: decision === 'approve'
          ? (result.nextAction === 'hr_approval' ? 'Approved! Escalated to HR.' : 'Approved!')
          : 'Rejected',
        nextAction: result.nextAction
      }, 'Manager decision processed');

    } catch (error) {
      console.error('Manager decision error:', error);
      return respondError(res, error.message, 500);
    }
  }

  /**
   * POST /api/expenses/:expenseId/hr-decision
   * Public endpoint for HR to approve/reject escalated expenses
   */
  async handleHRDecision(req, res) {
    try {
      const { expenseId } = req.params;
      const { token, decision, remarks } = req.body;

      console.log('👔 HR decision received:', { expenseId, decision });

      if (!token || !decision) {
        return respondError(res, 'Token and decision are required', 400);
      }

      if (!['approve', 'reject'].includes(decision)) {
        return respondError(res, 'Decision must be "approve" or "reject"', 400);
      }

      // Validate token
      const tokenValidation = await expenseService.validateApprovalToken(expenseId, token);
      if (!tokenValidation.valid) {
        return respondError(res, tokenValidation.reason, 401);
      }

      const expense = tokenValidation.expense;

      // Verify expense is awaiting HR approval
      if (expense.workflow_status !== 'pending_hr') {
        return respondError(res, `Expense is in "${expense.workflow_status}" state, cannot process HR decision`, 400);
      }

      // In a real scenario, get HR user ID from authenticated session
      // For now, use a placeholder
      const hrUserId = 1; // TODO: Get from authenticated user

      // Process decision
      const result = await expenseService.handleHRDecision(
        expenseId,
        decision,
        hrUserId,
        remarks || ''
      );

      // Trigger Power Automate for final notification
      const employee = await odooAdapter.getEmployee(result.expense.employee_id[0]);

      // Get manager details for Flow 2 (needed for fraudulent expense escalation)
      let manager = null;
      if (employee.parent_id && employee.parent_id[0]) {
        try {
          manager = await odooAdapter.getEmployee(employee.parent_id[0]);
        } catch (err) {
          console.error('⚠️  Could not fetch manager details:', err.message);
        }
      }

      const payloadForPA = {
        expenseId: parseInt(expenseId, 10),  // Parse to integer
        decision,
        approverType: 'hr',
        employeeId: parseInt(result.expense.employee_id[0], 10),  // Parse to integer
        employeeName: employee.name,
        employeeEmail: employee.work_email,
        amount: parseFloat(result.expense.total_amount),  // Parse to number
        category: result.expense.expense_category,
        remarks: remarks || '',
        workflowStatus: result.expense.workflow_status,
        processedAt: new Date().toISOString(),
        backendUrl: process.env.BACKEND_URL || 'http://localhost:5000',
        fraudDetectionStatus: result.expense.fraud_detection_status || 'not_run',
        approvalToken: result.expense.approval_token || null,
        managerEmail: manager ? (manager.work_email || manager.private_email) : null,
        managerName: manager ? manager.name : null
      };

      powerAutomateService.triggerApprovalResponseFlow(payloadForPA).catch(err => {
        console.error('⚠️  Power Automate decision notification failed:', err.message);
      });

      return respondSuccess(res, {
        success: true,
        expenseId,
        decision,
        message: decision === 'approve' ? 'Expense approved!' : 'Expense rejected',
        finalStatus: decision === 'approve' ? 'approved' : 'refused'
      }, 'HR decision processed');

    } catch (error) {
      console.error('HR decision error:', error);
      return respondError(res, error.message, 500);
    }
  }

  /**
   * GET /api/expenses/pending-approval
   * Get expenses pending approval (HR dashboard)
   */
  async getPendingApproval(req, res) {
    try {
      const { type } = req.query; // 'manager' or 'hr'
      const userRole = req.user.role;

      console.log('⏳ Pending approval list request:', { type });

      // Only HR/manager can access this
      if (userRole !== 'hr' && userRole !== 'manager') {
        return respondError(res, 'Only HR and managers can view pending approvals', 403);
      }

      const approvalType = type || 'manager';
      const pendingExpenses = await expenseService.getPendingApprovalExpenses(approvalType);

      // Add employee details to each expense
      const enrichedExpenses = await Promise.all(
        pendingExpenses.map(async (expense) => {
          try {
            const employee = await odooAdapter.getEmployee(expense.employee_id[0]);
            return {
              ...expense,
              employeeName: employee.name,
              employeeEmail: employee.work_email,
              department: employee.department_id ? employee.department_id[1] : 'Unknown'
            };
          } catch (err) {
            return expense;
          }
        })
      );

      return respondSuccess(res, {
        count: enrichedExpenses.length,
        approvalType,
        expenses: enrichedExpenses
      }, 'Pending approvals fetched successfully');

    } catch (error) {
      console.error('Get pending approval error:', error);
      return respondError(res, error.message, 500);
    }
  }

  /**
   * POST /api/expenses/:expenseId/escalate-to-manager
   * Escalate fraudulent expense to manager after HR approval (2-step approval)
   */
  async escalateToManagerAfterHR(req, res) {
    try {
      const { expenseId } = req.params;
      const { hrApprovalToken } = req.body;

      console.log('🔄 Escalating fraudulent expense to manager after HR approval:', expenseId);

      if (!hrApprovalToken) {
        return respondError(res, 'HR approval token required', 400);
      }

      // Escalate to manager (generates new token, updates workflow, sends email)
      const result = await expenseService.escalateToManagerAfterHRApproval(
        expenseId,
        hrApprovalToken
      );

      return respondSuccess(res, {
        success: true,
        expenseId,
        newApprovalToken: result.newApprovalToken,
        managerEmail: result.managerEmail,
        message: 'Expense escalated to manager for final approval'
      }, 'Escalated to manager successfully');

    } catch (error) {
      console.error('Escalate to manager error:', error);
      return respondError(res, error.message, 500);
    }
  }

  /**
   * GET /api/expenses/statistics
   * Get expense statistics for dashboard
   */
  async getStatistics(req, res) {
    try {
      const employeeId = req.user.employee_id;
      const userRole = req.user.role;

      console.log('📊 Statistics request');

      let expenses = [];

      if (userRole === 'hr' || userRole === 'manager') {
        expenses = await expenseService.getAllExpenses();
      } else {
        expenses = await expenseService.getEmployeeExpenses(employeeId);
      }

      // Calculate statistics
      const statistics = {
        totalExpenses: expenses.length,
        totalAmount: 0,
        byStatus: {},
        byCategory: {},
        pending: 0,
        approved: 0,
        rejected: 0
      };

      expenses.forEach(expense => {
        statistics.totalAmount += expense.amount || 0;

        // By status
        const status = expense.state || 'unknown';
        statistics.byStatus[status] = (statistics.byStatus[status] || 0) + 1;

        if (status.includes('pending')) {
          statistics.pending += 1;
        } else if (status === 'approved') {
          statistics.approved += 1;
        } else if (status === 'refused') {
          statistics.rejected += 1;
        }

        // By category
        const category = expense.category || 'Other';
        statistics.byCategory[category] = (statistics.byCategory[category] || 0) + 1;
      });

      return respondSuccess(res, statistics, 'Statistics fetched successfully');

    } catch (error) {
      console.error('Get statistics error:', error);
      return respondError(res, error.message, 500);
    }
  }
}

module.exports = new ExpenseController();
