const odooAdapter = require('../adapters/odooAdapter');

class LeaveService {
  // Submit leave request
  async submitLeaveRequest(employeeId, leaveData) {
    try {
      // 1. Validate leave balance
      const balance = await odooAdapter.getLeaveBalance(
        employeeId,
        leaveData.leave_type_id
      );

      if (balance.remaining < leaveData.number_of_days) {
        throw new Error('Insufficient leave balance');
      }

      // 2. Create leave in Odoo
      const leaveId = await odooAdapter.createLeaveRequest({
        employee_id: employeeId,
        ...leaveData
      });

      // 3. Trigger Power Automate for manager notification
      // (Add this later when setting up Power Automate)

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

  // Get leave balance
  async getEmployeeBalance(employeeId) {
    try {
      // Get leave type ID (Annual Leave - usually ID 1)
      const leaveTypes = await odooAdapter.searchRead('hr.leave.type',
        [['name', '=', 'Annual Leave']],
        ['id']
      );

      if (leaveTypes.length === 0) {
        throw new Error('Leave type not found');
      }

      return await odooAdapter.getLeaveBalance(employeeId, leaveTypes[0].id);
    } catch (error) {
      console.error('Balance fetch error:', error);
      throw error;
    }
  }

  // Get leave requests (for dashboards)
  async getLeaves(filters = {}) {
    return await odooAdapter.getLeaveRequests(filters);
  }

  // Approve/reject leave
  async updateLeaveStatus(leaveId, action, managerId, remarks = '') {
    try {
      const status = action === 'approve' ? 'approved' : 'rejected';

      await odooAdapter.updateLeaveStatus(leaveId, status, remarks);

      // Trigger Power Automate notification
      // (Add this when setting up flows)

      return {
        success: true,
        message: `Leave ${status} successfully`
      };
    } catch (error) {
      console.error('Leave update error:', error);
      throw error;
    }
  }
}

module.exports = new LeaveService();
