const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboardingController');
const upload = require('../utils/fileHandler');

// Initiate onboarding
router.post('/initiate', onboardingController.initiateOnboarding.bind(onboardingController));

// Upload document
router.post(
  '/upload-document',
  upload.single('document'),
  onboardingController.uploadDocument.bind(onboardingController)
);

// Get onboarding status
router.get('/status/:employeeId', onboardingController.getStatus.bind(onboardingController));

// Verify document (HR action)
router.put('/verify-document', onboardingController.verifyDocument.bind(onboardingController));

module.exports = router;
