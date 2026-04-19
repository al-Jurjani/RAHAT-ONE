const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken, requireRole('hr'));

router.get('/', departmentController.getDepartments.bind(departmentController));
router.get('/:departmentId/employees', departmentController.getDepartmentEmployees.bind(departmentController));
router.get('/:departmentId/managers', departmentController.getDepartmentManagers.bind(departmentController));
router.post('/:departmentId/assign-manager', departmentController.assignDepartmentManager.bind(departmentController));

module.exports = router;
