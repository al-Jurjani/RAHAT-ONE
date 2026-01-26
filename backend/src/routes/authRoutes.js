const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Public routes
router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/verify', authController.verifyToken);
router.post('/refresh', authController.refreshToken);

// Protected routes
router.post('/change-password', authenticateToken, authController.changePassword);
router.get('/me', authenticateToken, authController.getCurrentUser);

module.exports = router;
