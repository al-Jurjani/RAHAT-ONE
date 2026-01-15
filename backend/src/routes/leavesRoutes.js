const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { authenticateToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authenticateToken);

// ==========================================
// EMPLOYEE ROUTES
// ==========================================

/**
 * POST /api/leaves
 * Submit a new leave request
 */
router.post('/', leaveController.submitLeave);

/**
 * GET /api/leaves/balance
 * Get employee's leave balance
 */
router.get('/balance', leaveController.getBalance);

/**
 * GET /api/leaves/types
 * Get all available leave types
 */
router.get('/types', leaveController.getLeaveTypes);

/**
 * GET /api/leaves/my-leaves
 * Get all leaves for logged-in employee
 */
router.get('/my-leaves', leaveController.getMyLeaves);

/**
 * GET /api/leaves/statistics
 * Get leave statistics
 */
router.get('/statistics', leaveController.getStatistics);

// ==========================================
// HR/MANAGER ROUTES
// ==========================================

/**
 * GET /api/leaves
 * Get leave requests (with filters)
 * Query params: status, employee_id
 */
router.get('/', leaveController.getLeaves);

/**
 * PUT /api/leaves/:id/status
 * Approve or reject a leave request
 * Body: { action: 'approve' | 'reject', remarks: 'optional' }
 */
router.put('/:id/status', leaveController.updateStatus);

/**
 * GET /api/leaves/employee/:employeeId/balance
 * Get balance for specific employee (HR view)
 */
router.get('/employee/:employeeId/balance', authenticateToken, leaveController.getEmployeeBalance);

// ==========================================
// HR ALLOCATION ROUTES
// ==========================================

/**
 * GET /api/leaves/employees
 * Get all employees for allocation management
 */
router.get('/employees', authenticateToken, leaveController.getAllEmployees);

/**
 * POST /api/leaves/allocate
 * Allocate leave to an employee
 */
router.post('/allocate', authenticateToken, leaveController.allocateLeave);

module.exports = router;
