const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/hr', authenticateToken, requireRole('hr'), auditController.getHrAuditLogs);
router.get('/employee/:employeeId', authenticateToken, auditController.getEmployeeAuditLogs);

module.exports = router;
