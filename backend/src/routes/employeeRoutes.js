const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/', requireRole('hr'), employeeController.listEmployees.bind(employeeController));
router.get('/:employeeId', requireRole('hr'), employeeController.getEmployeeById.bind(employeeController));
router.patch('/:employeeId/branch', requireRole('hr'), employeeController.updateEmployeeBranch.bind(employeeController));
router.patch('/:employeeId/manager', requireRole('hr'), employeeController.updateEmployeeManager.bind(employeeController));

router.get('/profile/:employeeId', employeeController.getProfile);
router.patch('/profile/:employeeId', employeeController.updateProfile);
router.post('/profile/:employeeId/photo', employeeController.uploadProfilePhoto);
router.get('/profile/:employeeId/photo', employeeController.getProfilePhoto);

router.get('/leave-summary/:employeeId', employeeController.getLeaveSummary);
router.get('/expense-summary/:employeeId', employeeController.getExpenseSummary);

module.exports = router;
