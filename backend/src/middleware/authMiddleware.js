const authService = require('../services/authService');
const { respondError } = require('../utils/responseHandler');

/**
 * Verify JWT token middleware
 */
const authenticateToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return respondError(res, 'Access denied. No token provided.', 401);
    }

    const result = authService.verifyAccessToken(token);

    if (!result.valid) {
      return respondError(res, 'Invalid or expired token', 401);
    }

    // Attach user info to request
    req.user = result.user;
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    return respondError(res, 'Authentication failed', 401);
  }
};

/**
 * Check if user has required role
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return respondError(res, 'Access denied. Not authenticated.', 401);
    }

    if (!roles.includes(req.user.role)) {
      return respondError(res, 'Access denied. Insufficient permissions.', 403);
    }

    next();
  };
};

const requireManager = (req, res, next) => {
  if (!req.user) return respondError(res, 'Access denied. Not authenticated.', 401);
  if (!req.user.isManager) return respondError(res, 'Access denied. Manager role required.', 403);
  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireManager
};
