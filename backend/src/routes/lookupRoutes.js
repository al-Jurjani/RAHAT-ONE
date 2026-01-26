const express = require('express');
const router = express.Router();
const lookupController = require('../controllers/lookupController');

router.get('/departments', lookupController.getDepartments);
router.get('/positions', lookupController.getJobPositions);

module.exports = router;
