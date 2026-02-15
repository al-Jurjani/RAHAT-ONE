const express = require('express');
const router = express.Router();
const hrVerificationController = require('../controllers/hrVerificationController');

// HR-only routes
router.get('/pending', hrVerificationController.getPendingRegistrations);
router.get('/approved', hrVerificationController.getApprovedEmployees); // NEW
router.get('/rejected', hrVerificationController.getRejectedEmployees); // NEW
router.get('/details/:employeeId', hrVerificationController.getVerificationDetails);
router.get('/document/:documentId', hrVerificationController.getDocument);
router.post('/approve/:employeeId', hrVerificationController.approveCandidate);
router.post('/reject/:employeeId', hrVerificationController.rejectCandidate);
router.put('/:employeeId/override-assignment', hrVerificationController.overrideAssignment);

module.exports = router;
