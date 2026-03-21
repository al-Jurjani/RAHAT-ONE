const odooAdapter = require('../adapters/odooAdapter');

class LeaveService {
  /**
   * Submit a new leave request
   */
  async submitLeaveRequest(employeeId, leaveData) {
    try {
      // Policy checks (balance, probation, blackout, coverage, auto-approve)
      // are all owned by the Power Automate leave_policy_flow.
      // Backend just creates the record — PA does the rest.
      const leaveId = await odooAdapter.createLeaveRequest({
        employee_id: employeeId,
        ...leaveData
      });

      return {
        success: true,
        leaveId,
        message: 'Leave request submitted successfully'
      };
    } catch (error) {
      console.error('Leave submission error:', error);
      throw error;
    }
  }

  /**
   * Get employee leave balance
   */
  async getEmployeeBalance(employeeId, leaveTypeId = null) {
    try {
      return await odooAdapter.getLeaveBalance(employeeId, leaveTypeId);
    } catch (error) {
      console.error('Balance fetch error:', error);
      throw error;
    }
  }

  /**
   * Get all leave types
   */
  async getLeaveTypes() {
    try {
      return await odooAdapter.getLeaveTypes();
    } catch (error) {
      console.error('Leave types fetch error:', error);
      throw error;
    }
  }

  /**
   * Get leave requests (for dashboards)
   */
  async getLeaves(filters = {}) {
    try {
      return await odooAdapter.getLeaveRequests(filters);
    } catch (error) {
      console.error('Leaves fetch error:', error);
      throw error;
    }
  }

  /**
   * Get leave requests for a specific employee
   */
  async getEmployeeLeaves(employeeId, state = null) {
    try {
      const filters = { employee_id: employeeId };
      if (state) {
        filters.state = state;
      }
      return await odooAdapter.getLeaveRequests(filters);
    } catch (error) {
      console.error('Employee leaves fetch error:', error);
      throw error;
    }
  }

  // TODO: DELETE — PA flows now own all approval/rejection logic (Flow A + Flow B).
  // This method is dead code; no active route or controller calls it.
  /*
  async updateLeaveStatus(leaveId, action, managerId, remarks = '') {
    try {
      if (!['approve', 'reject'].includes(action)) {
        throw new Error('Invalid action. Must be "approve" or "reject"');
      }
      const leave = await odooAdapter.getLeaveById(leaveId);
      if (!leave) {
        throw new Error('Leave request not found');
      }
      await odooAdapter.updateLeaveStatus(leaveId, action, remarks);
      return {
        success: true,
        message: `Leave ${action === 'approve' ? 'approved' : 'rejected'} successfully`
      };
    } catch (error) {
      console.error('Leave update error:', error);
      throw error;
    }
  }
  */

  /**
   * Get leave statistics for dashboard
   */
  async getLeaveStatistics(employeeId = null) {
    try {
      const filters = employeeId ? { employee_id: employeeId } : {};
      const allLeaves = await odooAdapter.getLeaveRequests(filters);

      return {
        total: allLeaves.length,
        pending: allLeaves.filter(l => l.state === 'confirm').length,
        approved: allLeaves.filter(l => l.state === 'validate').length,
        rejected: allLeaves.filter(l => l.state === 'refuse').length
      };
    } catch (error) {
      console.error('Statistics fetch error:', error);
      throw error;
    }
  }

}

module.exports = new LeaveService();
