const odooAdapter = require('../adapters/odooAdapter');

class LeaveService {
  /**
   * Submit a new leave request
   */
  async submitLeaveRequest(employeeId, leaveData) {
    try {
      // 1. Validate leave balance
      const balanceCheck = await odooAdapter.checkLeaveBalance(
        employeeId,
        leaveData.leave_type_id,
        leaveData.number_of_days
      );

      if (!balanceCheck.sufficient) {
        throw new Error(
          `Insufficient leave balance. Available: ${balanceCheck.balance.remaining} days, Requested: ${leaveData.number_of_days} days`
        );
      }

      // 2. Create leave request in Odoo
      const leaveId = await odooAdapter.createLeaveRequest({
        employee_id: employeeId,
        ...leaveData
      });

      // 3. TODO: Trigger Power Automate flow for manager notification
      // This will be added when we set up Power Automate
      // await this.triggerLeaveNotification(leaveId, employeeId);

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

  /**
   * Approve or reject a leave request
   */
  async updateLeaveStatus(leaveId, action, managerId, remarks = '') {
    try {
      // Validate action
      if (!['approve', 'reject'].includes(action)) {
        throw new Error('Invalid action. Must be "approve" or "reject"');
      }

      // Get leave details before updating
      const leave = await odooAdapter.getLeaveById(leaveId);
      if (!leave) {
        throw new Error('Leave request not found');
      }

      // Update status in Odoo
      await odooAdapter.updateLeaveStatus(leaveId, action, remarks);

      // TODO: Trigger Power Automate notification to employee
      // This will be added when we set up Power Automate
      // await this.triggerLeaveStatusNotification(leaveId, action, leave.employee_id);

      return {
        success: true,
        message: `Leave ${action === 'approve' ? 'approved' : 'rejected'} successfully`
      };
    } catch (error) {
      console.error('Leave update error:', error);
      throw error;
    }
  }

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

  /**
   * Placeholder for Power Automate trigger
   * Will be implemented when setting up flows
   */
  async triggerLeaveNotification(leaveId, employeeId) {
    // TODO: Call Power Automate HTTP trigger
    console.log(`Triggering notification for leave ${leaveId}`);
  }

  async triggerLeaveStatusNotification(leaveId, action, employeeId) {
    // TODO: Call Power Automate HTTP trigger
    console.log(`Notifying employee about ${action} for leave ${leaveId}`);
  }
}

module.exports = new LeaveService();
