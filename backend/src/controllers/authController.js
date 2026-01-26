const authService = require('../services/authService');
const { respondSuccess, respondError } = require('../utils/responseHandler');

class AuthController {
  /**
   * POST /api/auth/login
   * User login
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return respondError(res, 'Email and password are required', 400);
      }

      const result = await authService.login(email, password);

      if (!result.success) {
        return respondError(res, result.message, 401);
      }

      return respondSuccess(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user
      }, 'Login successful');

    } catch (error) {
      console.error('Login controller error:', error);
      return respondError(res, 'Login failed', 500, error);
    }
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
        return respondError(res, result.message, 401);
      }

      return respondSuccess(res, { accessToken: result.accessToken }, 'Token refreshed');

    } catch (error) {
      console.error('Token refresh error:', error);
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
        return respondError(res, result.message, 400);
      }

      return respondSuccess(res, null, result.message);

    } catch (error) {
      console.error('Change password error:', error);
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
