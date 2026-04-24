const authService = require('../services/authService');
const { respondSuccess, respondError } = require('../utils/responseHandler');

const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
const ts = () => new Date().toISOString();

class AuthController {
  /**
   * POST /api/auth/login
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        console.warn(`[${ts()}] [AUTH] Login rejected — missing fields | ip:${ip(req)}`);
        return respondError(res, 'Email and password are required', 400);
      }

      console.log(`[${ts()}] [AUTH] Login attempt | email:${email} | ip:${ip(req)}`);

      const result = await authService.login(email, password);

      if (!result.success) {
        console.warn(`[${ts()}] [AUTH] Login FAILED | email:${email} | reason:${result.message} | ip:${ip(req)}`);
        return respondError(res, result.message, 401);
      }

      const u = result.user;
      console.log(`[${ts()}] [AUTH] Login SUCCESS | email:${email} | name:${u.name} | role:${u.role} | employeeId:${u.employeeId ?? 'none'} | isManager:${u.isManager} | ip:${ip(req)}`);

      return respondSuccess(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: u
      }, 'Login successful');

    } catch (error) {
      console.error(`[${ts()}] [AUTH] Login ERROR | email:${req.body?.email} | ip:${ip(req)}`, error);
      return respondError(res, 'Login failed', 500, error);
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(req, res) {
    const u = req.user;
    console.log(`[${ts()}] [AUTH] Logout | userId:${u?.userId} | name:${u?.name} | role:${u?.role} | ip:${ip(req)}`);
    return respondSuccess(res, null, 'Logged out');
  }

  /**
   * POST /api/auth/register
   * Register new user
   */
  async register(req, res) {
    try {
      const { name, email, password, role, employeeId } = req.body;

      // Validation
      if (!name || !email || !password) {
        return respondError(res, 'Name, email, and password are required', 400);
      }

      const result = await authService.register({
        name,
        email,
        password,
        role: role || 'employee',
        employeeId: employeeId || null
      });

      if (!result.success) {
        return respondError(res, result.message, 400);
      }

      return respondSuccess(res, {
        userId: result.userId
      }, result.message, 201);

    } catch (error) {
      console.error('Register controller error:', error);
      return respondError(res, 'Registration failed', 500, error);
    }
  }

  /**
   * POST /api/auth/verify
   * Verify JWT token
   */
  async verifyToken(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return respondError(res, 'No token provided', 401);
      }

      const result = authService.verifyAccessToken(token);

      if (!result.valid) {
        return respondError(res, 'Invalid token', 401);
      }

      return respondSuccess(res, { user: result.user }, 'Token is valid');

    } catch (error) {
      console.error('Token verification error:', error);
      return respondError(res, 'Token verification failed', 500, error);
    }
  }

  /**
   * POST /api/auth/refresh
   * Refresh access token
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return respondError(res, 'Refresh token is required', 400);
      }

      const result = await authService.refreshAccessToken(refreshToken);

      if (!result.success) {
        console.warn(`[${ts()}] [AUTH] Token refresh FAILED | ip:${ip(req)} | reason:${result.message}`);
        return respondError(res, result.message, 401);
      }

      console.log(`[${ts()}] [AUTH] Token refreshed | ip:${ip(req)}`);
      return respondSuccess(res, { accessToken: result.accessToken }, 'Token refreshed');

    } catch (error) {
      console.error(`[${ts()}] [AUTH] Token refresh ERROR | ip:${ip(req)}`, error);
      return respondError(res, 'Token refresh failed', 500, error);
    }
  }

  /**
   * POST /api/auth/change-password
   * Change user password
   */
  async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return respondError(res, 'Not authenticated', 401);
      }

      if (!oldPassword || !newPassword) {
        return respondError(res, 'Old password and new password are required', 400);
      }

      if (newPassword.length < 6) {
        return respondError(res, 'New password must be at least 6 characters', 400);
      }

      const result = await authService.changePassword(userId, oldPassword, newPassword);

      if (!result.success) {
        console.warn(`[${ts()}] [AUTH] Password change FAILED | userId:${userId} | reason:${result.message}`);
        return respondError(res, result.message, 400);
      }

      console.log(`[${ts()}] [AUTH] Password changed | userId:${userId} | ip:${ip(req)}`);
      return respondSuccess(res, null, result.message);

    } catch (error) {
      console.error(`[${ts()}] [AUTH] Password change ERROR | userId:${userId}`, error);
      return respondError(res, 'Password change failed', 500, error);
    }
  }

  /**
   * GET /api/auth/me
   * Get current user info
   */
  async getCurrentUser(req, res) {
    try {
      if (!req.user) {
        return respondError(res, 'Not authenticated', 401);
      }

      return respondSuccess(res, { user: req.user }, 'User retrieved');

    } catch (error) {
      console.error('Get current user error:', error);
      return respondError(res, 'Failed to get user', 500, error);
    }
  }
}

module.exports = new AuthController();
