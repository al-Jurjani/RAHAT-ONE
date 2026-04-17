const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.post('/checkin', authenticateToken, attendanceController.checkIn.bind(attendanceController));
router.post('/checkout', authenticateToken, attendanceController.checkOut.bind(attendanceController));
router.get('/today/:employeeId', authenticateToken, attendanceController.getTodayAttendance.bind(attendanceController));
router.get('/history/:employeeId', authenticateToken, attendanceController.getAttendanceHistory.bind(attendanceController));
router.get('/hr/summary', authenticateToken, requireRole('hr'), attendanceController.getHrSummary.bind(attendanceController));

module.exports = router;
