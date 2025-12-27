const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboardingController');

// Only keep this one
router.get('/status/:employeeId', onboardingController.getStatus.bind(onboardingController));

module.exports = router;
