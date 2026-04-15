const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const hrDashboardController = require('../controllers/hrDashboardController');

router.use(authenticateToken);

router.get('/dashboard-summary', hrDashboardController.getDashboardSummary);

module.exports = router;
