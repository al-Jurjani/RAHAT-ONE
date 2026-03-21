// const express = require('express');
// const router = express.Router();
// const leaveController = require('../controllers/leaveController');
// const { authenticateToken } = require('../middleware/authMiddleware');

// // All routes require authentication
// router.use(authenticateToken);

// // ==========================================
// // EMPLOYEE ROUTES
// // ==========================================

// /**
//  * POST /api/leaves
//  * Submit a new leave request
//  */
// router.post('/', leaveController.submitLeave);

// /**
//  * GET /api/leaves/balance
//  * Get employee's leave balance
//  */
// router.get('/balance', leaveController.getBalance);

// /**
//  * GET /api/leaves/types
//  * Get all available leave types
//  */
// router.get('/types', leaveController.getLeaveTypes);

// /**
//  * GET /api/leaves/my-leaves
//  * Get all leaves for logged-in employee
//  */
// router.get('/my-leaves', leaveController.getMyLeaves);

// /**
//  * GET /api/leaves/statistics
//  * Get leave statistics
//  */
// router.get('/statistics', leaveController.getStatistics);

// // ==========================================
// // HR/MANAGER ROUTES
// // ==========================================

// /**
//  * GET /api/leaves
//  * Get leave requests (with filters)
//  * Query params: status, employee_id
//  */
// router.get('/', leaveController.getLeaves);

// /**
//  * PUT /api/leaves/:id/status
//  * Approve or reject a leave request
//  * Body: { action: 'approve' | 'reject', remarks: 'optional' }
//  */
// router.put('/:id/status', leaveController.updateStatus);

// /**
//  * GET /api/leaves/employee/:employeeId/balance
//  * Get balance for specific employee (HR view)
//  */
// router.get('/employee/:employeeId/balance', authenticateToken, leaveController.getEmployeeBalance);

// // ==========================================
// // HR ALLOCATION ROUTES
// // ==========================================

// /**
//  * GET /api/leaves/employees
//  * Get all employees for allocation management
//  */
// router.get('/employees', authenticateToken, leaveController.getAllEmployees);

// /**
//  * POST /api/leaves/allocate
//  * Allocate leave to an employee
//  */
// router.post('/allocate', authenticateToken, leaveController.allocateLeave);

// // PUT /api/leaves/:id/status - Approve or reject leave
// router.put('/:id/status', authenticateToken, leaveController.updateStatus);

// // Manager decision webhook (called by Power Automate)
// router.post('/:id/manager-decision', leaveController.managerDecision);

// router.get('/:id/messages', leaveController.getLeaveMessages);



// module.exports = router;

const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/public/:id', leaveController.getPublicLeave);

/**
 * POST /api/leaves/:id/manager-decision
 * Manager decision webhook (called by Power Automate)
 * Body: { decision: 'approved' | 'rejected', managerName, managerEmail, remarks }
 */
router.post('/:id/manager-decision', leaveController.managerDecision);

// All routes require authentication
router.use(authenticateToken);



// ==========================================
// SPECIFIC ROUTES FIRST (before catch-all routes)
// ==========================================

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

/**
 * GET /api/leaves/employees
 * Get all employees for allocation management
 */
router.get('/employees', leaveController.getAllEmployees);

/**
 * GET /api/leaves/employee/:employeeId/balance
 * Get balance for specific employee (HR view)
 */
router.get('/employee/:employeeId/balance', leaveController.getEmployeeBalance);

/**
 * POST /api/leaves/allocate
 * Allocate leave to an employee
 */
router.post('/allocate', leaveController.allocateLeave);

/**
 * GET /api/config/blackout-dates
 * Get current blackout periods (HR management)
 */
router.get('/config/blackout-dates', leaveController.getBlackoutDates);

/**
 * PUT /api/config/blackout-dates
 * Replace blackout periods list (HR management)
 */
router.put('/config/blackout-dates', leaveController.updateBlackoutDates);

/**
 * GET /api/leaves/:id/messages
 * Get messages/notes for a leave request
 */
router.get('/:id/messages', leaveController.getLeaveMessages);

// PUT /api/leaves/:id/status — disabled (PA owns approvals)
// router.put('/:id/status', leaveController.updateStatus);



// ==========================================
// GENERAL ROUTES LAST (catch-all routes)
// ==========================================

/**
 * POST /api/leaves
 * Submit a new leave request
 */
router.post('/', leaveController.submitLeave);

/**
 * GET /api/leaves
 * Get leave requests (with filters)
 * Query params: status, employee_id
 */
router.get('/', leaveController.getLeaves);

module.exports = router;
