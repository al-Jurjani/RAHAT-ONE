const jwt = require('jsonwebtoken');
const odooAdapter = require('../adapters/odooAdapter');

const JWT_SECRET = process.env.JWT_SECRET || 'rahatone-secret-key-change-in-production';
const JWT_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '7d';

class AuthService {
  /**
   * Login with Odoo user authentication
   */
  async login(email, password) {
    try {
      console.log('🔐 Login attempt:', email);

      // Search for user in Odoo
      const users = await odooAdapter.execute('res.users', 'search_read', [
        [
          ['login', '=', email],
          ['is_rahatone_user', '=', true]
        ],
        ['id', 'name', 'login', 'email', 'rahatone_role', 'account_status', 'employee_id']
      ]);

      if (users.length === 0) {
        console.log('❌ User not found:', email);
        return { success: false, message: 'Invalid email or password' };
      }

      const user = users[0];

      // Check if account is locked
      if (user.account_status === 'locked') {
        console.log('🔒 Account locked:', email);
        return { success: false, message: 'Account is locked. Please contact administrator.' };
      }

      if (user.account_status === 'inactive') {
        console.log('❌ Account inactive:', email);
        return { success: false, message: 'Account is inactive. Please contact administrator.' };
      }

      // Verify password via Odoo method
      const isValid = await odooAdapter.execute('res.users', 'verify_rahatone_password', [
        [user.id],
        password
      ]);

      if (!isValid) {  // ✅ CORRECT - Odoo returns true/false directly, not an array
        console.log('❌ Invalid password for:', email);

        // Increment failed login counter
        await odooAdapter.execute('res.users', 'increment_failed_login', [[user.id]]);

        return { success: false, message: 'Invalid email or password' };
      }

      // Reset failed login counter
      await odooAdapter.execute('res.users', 'reset_failed_login', [[user.id]]);

      // Detect if this employee is a manager (anyone reports to them)
      let isManager = false;
      let managerBranchId = null;

      if (user.rahatone_role === 'employee' && Array.isArray(user.employee_id) && user.employee_id[0]) {
        const employeeOdooId = user.employee_id[0];
        console.log('[Auth] Checking manager status for employee Odoo ID:', employeeOdooId);

        const reportCount = await odooAdapter.execute('hr.employee', 'search_count', [
          [['parent_id', '=', employeeOdooId], ['active', '=', true]]
        ]);
        console.log('[Auth] Employees reporting to this user:', reportCount);

        if (reportCount > 0) {
          isManager = true;
          const selfRecord = await odooAdapter.execute('hr.employee', 'search_read', [
            [['id', '=', employeeOdooId]],
            ['id', 'branch_id']
          ]);
          console.log('[Auth] Manager self record branch_id:', selfRecord?.[0]?.branch_id);
          if (selfRecord && selfRecord[0] && Array.isArray(selfRecord[0].branch_id)) {
            managerBranchId = selfRecord[0].branch_id[0];
          }
        }
      }
      console.log('[Auth] isManager:', isManager, '| managerBranchId:', managerBranchId);

      // Generate tokens
      const accessToken = this._generateAccessToken(user, isManager, managerBranchId);
      const refreshToken = this._generateRefreshToken(user, isManager, managerBranchId);

      console.log('✅ Login successful:', email, '| Role:', user.rahatone_role, isManager ? '| Manager of branch:' + managerBranchId : '');

      return {
        success: true,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.rahatone_role,
          employeeId: user.employee_id ? user.employee_id[0] : null,
          isManager,
          managerBranchId
        }
      };

    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  }

  /**
   * Register new user
   */
  async register(userData) {
    try {
      const { name, email, password, role = 'employee', employeeId = null } = userData;

      console.log('📝 Registering new user:', email);

      // Create user via Odoo method
      const userId = await odooAdapter.execute('res.users', 'create_rahatone_user', [
        [],
        name,
        email,
        password,
        role,
        employeeId
      ]);

      console.log('✅ User created:', userId);

      return {
        success: true,
        userId,
        message: 'User registered successfully'
      };

    } catch (error) {
      console.error('❌ Registration error:', error);

      if (error.message && error.message.includes('already exists')) {
        return { success: false, message: 'User with this email already exists' };
      }

      throw error;
    }
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return { valid: true, user: decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET);

      // Generate new access token
      const accessToken = this._generateAccessToken({
        id: decoded.userId,
        name: decoded.name,
        email: decoded.email,
        rahatone_role: decoded.role
      });

      return {
        success: true,
        accessToken
      };

    } catch (error) {
      return { success: false, message: 'Invalid or expired refresh token' };
    }
  }

  /**
   * Change password
   */
  async changePassword(userId, oldPassword, newPassword) {
    try {
      // Verify old password first
      const users = await odooAdapter.execute('res.users', 'search_read', [
        [['id', '=', userId]],
        ['id', 'login']
      ]);

      if (users.length === 0) {
        return { success: false, message: 'User not found' };
      }

      const isValid = await odooAdapter.execute('res.users', 'verify_rahatone_password', [
        [userId],
        oldPassword
      ]);

      if (!isValid || !isValid[0]) {
        return { success: false, message: 'Current password is incorrect' };
      }

      // Set new password
      await odooAdapter.execute('res.users', 'set_rahatone_password', [
        [userId],
        newPassword
      ]);

      console.log('✅ Password changed for user:', userId);

      return { success: true, message: 'Password changed successfully' };

    } catch (error) {
      console.error('❌ Change password error:', error);
      throw error;
    }
  }

  // Private helper methods
  _generateAccessToken(user, isManager = false, managerBranchId = null) {
    return jwt.sign(
      {
        userId: user.id,
        employee_id: user.employee_id ? user.employee_id[0] : null,
        email: user.email || user.login,
        name: user.name,
        role: user.rahatone_role,
        isManager,
        managerBranchId
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
  }

  _generateRefreshToken(user, isManager = false, managerBranchId = null) {
    return jwt.sign(
      {
        userId: user.id,
        employee_id: user.employee_id ? user.employee_id[0] : null,
        email: user.email || user.login,
        name: user.name,
        role: user.rahatone_role,
        isManager,
        managerBranchId
      },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
  }
}

module.exports = new AuthService();
