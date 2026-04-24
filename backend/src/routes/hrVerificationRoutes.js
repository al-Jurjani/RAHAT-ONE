const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const hrVerificationController = require('../controllers/hrVerificationController');

router.use(authenticateToken);

// HR-only routes
router.get('/pending', hrVerificationController.getPendingRegistrations);
router.get('/approved', hrVerificationController.getApprovedEmployees);
router.get('/auto-approved', hrVerificationController.getAutoApprovedEmployees);
router.get('/rejected', hrVerificationController.getRejectedEmployees);
router.get('/details/:employeeId', hrVerificationController.getVerificationDetails);
router.get('/document/:documentId', hrVerificationController.getDocument);
router.post('/approve/:employeeId', hrVerificationController.approveCandidate);
router.post('/reject/:employeeId', hrVerificationController.rejectCandidate);

module.exports = router;
