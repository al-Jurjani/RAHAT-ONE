const leaveService = require('../services/leaveService');

class LeaveController {
  // POST /api/leaves - Submit leave request
  async submitLeave(req, res) {
    try {
      const employeeId = req.user.employee_id; // From JWT
      const leaveData = req.body;

      const result = await leaveService.submitLeaveRequest(employeeId, leaveData);

      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // GET /api/leaves/balance - Get leave balance
  async getBalance(req, res) {
    try {
      const employeeId = req.user.employee_id;

      const balance = await leaveService.getEmployeeBalance(employeeId);

      res.json(balance);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // GET /api/leaves - Get leave requests (for HR/Manager)
  async getLeaves(req, res) {
    try {
      const filters = {
        state: req.query.status,
        employee_id: req.query.employee_id
      };

      const leaves = await leaveService.getLeaves(filters);

      res.json(leaves);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // PUT /api/leaves/:id/status - Approve/reject leave
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { action, remarks } = req.body; // action: 'approve' | 'reject'
      const managerId = req.user.id;

      const result = await leaveService.updateLeaveStatus(
        id,
        action,
        managerId,
        remarks
      );

      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new LeaveController();
