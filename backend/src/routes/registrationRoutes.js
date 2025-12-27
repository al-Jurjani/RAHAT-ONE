const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');

// Public routes (no auth required)
router.post('/initiate', registrationController.initiateOnboarding);
router.post('/complete', registrationController.completeRegistration);
router.get('/status', registrationController.getRegistrationStatus);

module.exports = router;
