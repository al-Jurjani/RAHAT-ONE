const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Employee routes
router.post('/', leaveController.submitLeave);
router.get('/balance', leaveController.getBalance);

// HR/Manager routes
router.get('/', leaveController.getLeaves);
router.put('/:id/status', leaveController.updateStatus);

module.exports = router;
