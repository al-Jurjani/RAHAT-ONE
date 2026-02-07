const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { authenticateToken } = require('../middleware/authMiddleware');

// ==========================================
// AUTHENTICATED ROUTES (require token)
// ==========================================

/**
 * POST /api/expenses/submit
 * Submit a new expense
 * Body: { category, amount, vendor_name, expense_date, description }
 * Files: invoice (optional)
 */
router.post('/submit', authenticateToken, expenseController.submitExpense);

/**
 * GET /api/expenses
 * List expenses (filtered by role: employee sees own, HR/manager sees all)
 * Query params: status, category, dateFrom, dateTo, vendor
 */
router.get('/', authenticateToken, expenseController.listExpenses);

/**
 * GET /api/expenses/pending-approval
 * Get expenses pending approval (HR dashboard)
 * Query params: type ('manager' or 'hr')
 */
router.get('/pending-approval', authenticateToken, expenseController.getPendingApproval);

/**
 * GET /api/expenses/statistics
 * Get expense statistics for dashboard
 */
router.get('/statistics', authenticateToken, expenseController.getStatistics);

/**
 * GET /api/expenses/:id/attachment
 * Get expense attachment
 */
router.get('/:id/attachment', authenticateToken, expenseController.getExpenseAttachment);

/**
 * GET /api/expenses/:id
 * Get expense details (authorized access)
 */
router.get('/:id', authenticateToken, expenseController.getExpenseDetails);

// ==========================================
// PUBLIC ROUTES (token-based, no auth required)
// ==========================================

/**
 * GET /api/expenses/public/:expenseId
 * Public endpoint for approval page (token-based like ApproveLeave)
 * Query params: token
 */
router.get('/public/:expenseId', expenseController.getExpenseForApproval);

/**
 * GET /api/expenses/public/:expenseId/invoice
 * Public endpoint for viewing invoice attachment
 * Query params: token
 */
router.get('/public/:expenseId/invoice', expenseController.getPublicInvoicePreview);

/**
 * POST /api/expenses/:expenseId/manager-decision
 * Public endpoint for manager to approve/reject
 * Body: { token, decision ('approve'|'reject'), remarks (optional) }
 */
router.post('/:expenseId/manager-decision', expenseController.handleManagerDecision);

/**
 * POST /api/expenses/:expenseId/hr-decision
 * Public endpoint for HR to approve/reject (escalated items)
 * Body: { token, decision ('approve'|'reject'), remarks (optional) }
 */
router.post('/:expenseId/hr-decision', expenseController.handleHRDecision);

module.exports = router;
