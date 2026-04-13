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
// PUBLIC TOKEN ROUTES (approval page + decision handoff)
// ==========================================
router.get('/public/:expenseId', expenseController.getExpenseForApproval);
router.get('/public/:expenseId/invoice', expenseController.getPublicInvoicePreview);
router.post('/:expenseId/manager-decision', expenseController.handleManagerDecision);
router.post('/:expenseId/hr-decision', expenseController.handleHRDecision);

module.exports = router;
