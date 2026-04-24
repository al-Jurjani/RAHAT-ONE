const expenseService = require('../services/expenseService');
// [n8n-migration] powerAutomateService no longer called from controller — service handles webhook
// const powerAutomateService = require('../services/powerAutomateService');
const odooAdapter = require('../adapters/odooAdapter');
const { respondSuccess, respondError } = require('../utils/responseHandler');

class ExpenseController {
  /**
   * POST /api/expenses/submit
   * Submit a new expense (requires authentication)
   * THINNED: Backend creates draft + fires n8n webhook. Returns 202.
   */
  async submitExpense(req, res) {
    try {
      const employeeId = req.user.employee_id;
      const expenseData = req.body;
      let invoiceFile = null;

      console.log('[ExpenseController] Expense submission received');
      console.log('   Employee ID:', employeeId);

      // Validate required fields
      const requiredFields = ['category', 'amount', 'vendor_name', 'expense_date', 'description'];
      const missingFields = requiredFields.filter(field => !expenseData[field]);

      if (missingFields.length > 0) {
        return respondError(res, `Missing required fields: ${missingFields.join(', ')}`, 400);
      }

      // Handle file upload if present
      if (req.files && req.files.invoice) {
        invoiceFile = req.files.invoice;
      }

      // Submit expense (creates Odoo record + fires n8n webhook)
      const result = await expenseService.submitExpense(employeeId, expenseData, invoiceFile);

      // Return 202 Accepted — n8n handles all orchestration from here
      return res.status(202).json({
        success: true,
        data: {
          expenseId: result.expenseId,
          status: result.status
        },
        message: 'Expense submitted — processing started'
      });

    } catch (error) {
      console.error('Expense submission error:', error);
      return respondError(res, error.message, 500);
    }
  }

  // [n8n-migration] Original submitExpense controller with manager lookup,
  // PA payload construction, and full response body commented out below.
  /*
  async submitExpense_ORIGINAL(req, res) {
    try {
      const employeeId = req.user.employee_id;
      const expenseData = req.body;
      let invoiceFile = null;

      const requiredFields = ['category', 'amount', 'vendor_name', 'expense_date', 'description'];
      const missingFields = requiredFields.filter(field => !expenseData[field]);
      if (missingFields.length > 0) return respondError(res, `Missing required fields: ${missingFields.join(', ')}`, 400);

      const employee = await odooAdapter.getEmployee(employeeId);
      if (!employee) return respondError(res, 'Employee not found', 404);

      if (req.files && req.files.invoice) invoiceFile = req.files.invoice;

      const result = await expenseService.submitExpense(employeeId, expenseData, invoiceFile);

      let managerEmail = null, managerName = null;
      if (employee.parent_id && employee.parent_id[0]) {
        try {
          const manager = await odooAdapter.getEmployee(employee.parent_id[0]);
          managerEmail = manager.work_email || manager.private_email || 'sigh.and.wave@gmail.com';
          managerName = manager.name;
        } catch (err) { managerEmail = 'sigh.and.wave@gmail.com'; }
      }

      return respondSuccess(res, {
        expenseId: result.expenseId, status: result.expense.workflow_status,
        message: result.message, policyViolations: result.policyViolations,
        escalatedForHR: result.escalatedForHR, fraudDetection: result.fraudDetection
      }, 'Expense submitted successfully');
    } catch (error) { console.error('Expense submission error:', error); return respondError(res, error.message, 500); }
  }
  */

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
   * Public endpoint for manager approval page (token protected)
   */
  async getExpenseForApproval(req, res) {
    try {
      const { expenseId } = req.params;
      const { token } = req.query;

      if (!token) {
        return respondError(res, 'Approval token is required', 400);
      }

      const validation = await expenseService.validateApprovalToken(expenseId, token);
      if (!validation.valid) {
        return respondError(res, validation.reason, 401);
      }

      const expense = validation.expense;
      const employee = expense.employee_id?.[0]
        ? await odooAdapter.getEmployee(expense.employee_id[0])
        : null;

      return respondSuccess(res, {
        expense,
        employee: employee || { name: 'Unknown', work_email: null }
      }, 'Expense fetched for approval');
    } catch (error) {
      console.error('Get expense for approval error:', error);
      return respondError(res, error.message, 500);
    }
  }

  /**
   * GET /api/expenses/public/:expenseId/invoice
   * Public endpoint for invoice preview in manager approval page (token protected)
   */
  async getPublicInvoicePreview(req, res) {
    try {
      const { expenseId } = req.params;
      const { token } = req.query;

      if (!token) {
        return respondError(res, 'Approval token is required', 400);
      }

      const validation = await expenseService.validateApprovalToken(expenseId, token);
      if (!validation.valid) {
        return respondError(res, validation.reason, 401);
      }

      const attachment = await odooAdapter.getExpenseAttachment(expenseId);

      if (!attachment || !attachment.datas) {
        return respondError(res, 'Invoice attachment not found', 404);
      }

      const fileBuffer = Buffer.from(attachment.datas, 'base64');
      const fileName = (attachment.name || `expense-${expenseId}-invoice`).replace(/"/g, '');

      res.setHeader('Content-Type', attachment.mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.status(200).send(fileBuffer);
    } catch (error) {
      console.error('Get public invoice preview error:', error);
      return respondError(res, error.message, 500);
    }
  }

  /**
   * POST /api/expenses/:expenseId/manager-decision
   * Token-protected decision endpoint; backend validates token and forwards to n8n Flow 2.
   */
  async handleManagerDecision(req, res) {
    try {
      const { expenseId } = req.params;
      const { token, decision, remarks } = req.body;

      if (!token) {
        return respondError(res, 'Approval token is required', 400);
      }

      if (!['approve', 'reject'].includes(decision)) {
        return respondError(res, 'Decision must be either approve or reject', 400);
      }

      const validation = await expenseService.validateApprovalToken(expenseId, token);
      if (!validation.valid) {
        return respondError(res, validation.reason, 401);
      }

      await expenseService.handleManagerDecision(expenseId, decision, remarks, token);

      return respondSuccess(res, {
        expenseId: Number(expenseId),
        decision,
        status: 'queued'
      }, 'Manager decision accepted and forwarded to workflow');
    } catch (error) {
      console.error('Handle manager decision error:', error);
      return respondError(res, error.message, 500);
    }
  }

  /**
   * POST /api/expenses/:expenseId/hr-decision
   * Token-protected HR decision endpoint; forwarded to n8n HR flow.
   */
  async handleHRDecision(req, res) {
    try {
      const { expenseId } = req.params;
      const { token, decision, remarks } = req.body;

      if (!token) {
        return respondError(res, 'Approval token is required', 400);
      }

      if (!['approve', 'reject'].includes(decision)) {
        return respondError(res, 'Decision must be either approve or reject', 400);
      }

      const validation = await expenseService.validateApprovalToken(expenseId, token);
      if (!validation.valid) {
        return respondError(res, validation.reason, 401);
      }

      await expenseService.handleHRDecision(expenseId, decision, remarks, token, req.user?.name || 'HR');

      return respondSuccess(res, {
        expenseId: Number(expenseId),
        decision,
        status: 'queued'
      }, 'HR decision accepted and forwarded to workflow');
    } catch (error) {
      console.error('Handle HR decision error:', error);
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

  // [n8n-migration] Escalation no longer needed — HR decision is final in n8n flow.
  // If HR approves a fraudulent expense, n8n sends audit email to senior HR (fire-and-forget).
  /*
  async escalateToManagerAfterHR(req, res) { ... }
  */

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
