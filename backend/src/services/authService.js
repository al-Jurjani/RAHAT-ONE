const jwt = require('jsonwebtoken');
const odooAdapter = require('../adapters/odooAdapter');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set — refusing to start');
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

      // Consolidated employee fetch: detect HR role via dept+job, then manager status
      let effectiveRole = user.rahatone_role;
      let isManager = false;
      let managerBranchId = null;
      // Prefer hr.employee.name over res.users.name — the user account may have a generic
      // name (e.g. "HR") while the employee record holds the person's actual name.
      let displayName = user.name;
      const employeeOdooId = Array.isArray(user.employee_id) && user.employee_id[0] ? user.employee_id[0] : null;

      console.log('[Auth] user.employee_id raw:', user.employee_id, '| employeeOdooId:', employeeOdooId);

      const resolveEmployee = async (empId) => {
        const records = await odooAdapter.execute('hr.employee', 'search_read', [
          [['id', '=', empId]],
          ['id', 'name', 'department_id', 'job_id', 'branch_id']
        ]);
        return records[0] || null;
      };

      let emp = null;
      if (employeeOdooId) {
        emp = await resolveEmployee(employeeOdooId);
      }

      // Fallback: find employee by work email when employee_id is not linked on res.users
      if (!emp) {
        const loginEmail = user.email || user.login;
        if (loginEmail) {
          const byEmail = await odooAdapter.execute('hr.employee', 'search_read', [
            [['work_email', '=', loginEmail], ['active', '=', true]],
            ['id', 'name', 'department_id', 'job_id', 'branch_id']
          ]);
          emp = byEmail[0] || null;
          if (emp) console.log('[Auth] Employee resolved by work_email fallback, id:', emp.id);
        }
      }

      if (emp) {
        if (emp.name) displayName = emp.name;

        const deptName  = Array.isArray(emp.department_id) ? (emp.department_id[1] || '') : '';
        const jobName   = Array.isArray(emp.job_id)        ? (emp.job_id[1]        || '') : '';
        const deptLower = deptName.toLowerCase();
        const jobLower  = jobName.toLowerCase();
        const isHrDept      = deptLower.includes('hr') || deptLower.includes('human resource');
        const isHrSeniorJob = ['hr manager', 'hr officer'].some((j) => jobLower.includes(j));
        if (isHrDept && isHrSeniorJob) {
          effectiveRole = 'hr';
          console.log('[Auth] HR role granted via department+job:', deptName, '/', jobName);
        }

        const reportCount = await odooAdapter.execute('hr.employee', 'search_count', [
          [['parent_id', '=', emp.id], ['active', '=', true]]
        ]);
        if (reportCount > 0) {
          isManager = true;
          // Only Store Managers get a branchId — regular dept managers use direct-report scope
          const isStoreManager = jobLower.includes('store manager');
          if (isStoreManager && Array.isArray(emp.branch_id) && emp.branch_id[0]) {
            managerBranchId = emp.branch_id[0];
          }
        }
      }

      console.log('[Auth] effectiveRole:', effectiveRole, '| isManager:', isManager, '| displayName:', displayName);

      const tokenUser = { ...user, name: displayName };
      const accessToken = this._generateAccessToken(tokenUser, effectiveRole, isManager, managerBranchId);
      const refreshToken = this._generateRefreshToken(tokenUser, effectiveRole, isManager, managerBranchId);

      console.log('✅ Login successful:', email, '| Role:', effectiveRole, isManager ? '| Manager of branch:' + managerBranchId : '');

      return {
        success: true,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: displayName,
          email: user.email,
          role: effectiveRole,
          employeeId: employeeOdooId,
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

      if (!isValid) {
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
  _generateAccessToken(user, effectiveRole = null, isManager = false, managerBranchId = null) {
    return jwt.sign(
      {
        userId: user.id,
        employee_id: user.employee_id ? user.employee_id[0] : null,
        email: user.email || user.login,
        name: user.name,
        role: effectiveRole ?? user.rahatone_role,
        isManager,
        managerBranchId
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
  }

  _generateRefreshToken(user, effectiveRole = null, isManager = false, managerBranchId = null) {
    return jwt.sign(
      {
        userId: user.id,
        employee_id: user.employee_id ? user.employee_id[0] : null,
        email: user.email || user.login,
        name: user.name,
        role: effectiveRole ?? user.rahatone_role,
        isManager,
        managerBranchId
      },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
  }
}

module.exports = new AuthService();
