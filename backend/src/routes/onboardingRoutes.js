const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboardingController');

router.post('/initiate', onboardingController.initiateOnboarding.bind(onboardingController));
router.get('/status/:employeeId', onboardingController.getStatus.bind(onboardingController));

module.exports = router;
