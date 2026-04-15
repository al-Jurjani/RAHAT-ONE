const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/profile/:employeeId', employeeController.getProfile);
router.patch('/profile/:employeeId', employeeController.updateProfile);
router.post('/profile/:employeeId/photo', employeeController.uploadProfilePhoto);
router.get('/profile/:employeeId/photo', employeeController.getProfilePhoto);

router.get('/leave-summary/:employeeId', employeeController.getLeaveSummary);
router.get('/expense-summary/:employeeId', employeeController.getExpenseSummary);

module.exports = router;
