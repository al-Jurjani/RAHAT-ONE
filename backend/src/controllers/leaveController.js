const leaveService = require('../services/leaveService');
const { respondSuccess, respondError } = require('../utils/responseHandler');
const odooAdapter = require('../adapters/odooAdapter');

class LeaveController {
  /**
   * POST /api/leaves
   * Submit a new leave request
   */
  async submitLeave(req, res) {
    try {
      const employeeId = req.user.employee_id; // From JWT middleware
      const leaveData = req.body;

      // Validate required fields
      if (!leaveData.leave_type_id || !leaveData.date_from || !leaveData.date_to || !leaveData.number_of_days) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      const result = await leaveService.submitLeaveRequest(employeeId, leaveData);

      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GET /api/leaves/balance
   * Get employee's leave balance
   */
  async getBalance(req, res) {
    try {
      const employeeId = req.user.employee_id;
      const leaveTypeId = req.query.leave_type_id ? parseInt(req.query.leave_type_id) : null;

      // ADD THESE DEBUG LINES
      console.log('🔍 DEBUG - getBalance called');
      console.log('   req.user:', req.user);
      console.log('   employee_id:', employeeId);
      console.log('   leave_type_id:', leaveTypeId);

      if (!employeeId) {
        return respondError(res, 'Employee ID not found in token', 400);
      }

      const balance = await leaveService.getEmployeeBalance(employeeId, leaveTypeId);

      // ADD THIS DEBUG LINE
      console.log('   balance result:', balance);

      return respondSuccess(res, balance);
    } catch (error) {
      console.error('Balance fetch error:', error);
      return respondError(res, error.message, 500);
    }
  }

  /**
   * GET /api/leaves/types
   * Get all leave types
   */
  async getLeaveTypes(req, res) {
    try {
      const types = await leaveService.getLeaveTypes();
      res.json(types);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GET /api/leaves
   * Get leave requests (for HR dashboard or employee history)
   */
  async getLeaves(req, res) {
    try {
      const filters = {};

      // If user is employee, only show their leaves
      if (req.user.role === 'employee') {
        filters.employee_id = req.user.employee_id;
      }

      // If status filter provided
      if (req.query.status) {
        filters.state = req.query.status;
      }

      // If specific employee_id provided (HR/Manager view)
      if (req.query.employee_id && req.user.role !== 'employee') {
        filters.employee_id = parseInt(req.query.employee_id);
      }

      const leaves = await leaveService.getLeaves(filters);

      res.json(leaves);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GET /api/leaves/my-leaves
   * Get all leaves for logged-in employee
   */
  async getMyLeaves(req, res) {
    try {
      const employeeId = req.user.employee_id;
      const state = req.query.status || null;

      const leaves = await leaveService.getEmployeeLeaves(employeeId, state);

      res.json(leaves);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * PUT /api/leaves/:id/status
   * Approve or reject a leave request
   */
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { action, remarks } = req.body;
      const managerId = req.user.id;

      // Validate action
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Must be "approve" or "reject"'
        });
      }

      // TODO: Check if user is authorized (manager/HR)
      // For now, we'll allow any authenticated user

      const result = await leaveService.updateLeaveStatus(
        parseInt(id),
        action,
        managerId,
        remarks || ''
      );

      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GET /api/leaves/statistics
   * Get leave statistics for dashboard
   */
  async getStatistics(req, res) {
    try {
      // If employee, get their stats only
      const employeeId = req.user.role === 'employee' ? req.user.employee_id : null;

      const stats = await leaveService.getLeaveStatistics(employeeId);

      res.json(stats);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get all employees (for allocation management)
   * GET /api/hr/employees
   */
  getAllEmployees = async (req, res) => {
    try {
      const employees = await odooAdapter.searchAndReadEmployees(
        [['active', '=', true]],
        { limit: 1000 }
      );

      return respondSuccess(res, employees);
    } catch (error) {
      console.error('Get employees error:', error);
      return respondError(res, error.message, 500);
    }
  };

  /**
   * Allocate leave to an employee
   * POST /api/leaves/allocate
   */
  allocateLeave = async (req, res) => {
    try {
      const { employee_id, leave_type_id, days, start_date, end_date } = req.body;

      if (!employee_id || !leave_type_id || !days) {
        return respondError(res, 'Missing required fields', 400);
      }

      const allocationId = await odooAdapter.create('hr.leave.allocation', {
        name: `Leave Allocation ${new Date().toISOString().split('T')[0]}`,
        holiday_status_id: leave_type_id,
        employee_id: employee_id,
        number_of_days: days,
        date_from: start_date,
        date_to: end_date,
        state: 'confirm'
      });

      // Validate the allocation
      await odooAdapter.execute('hr.leave.allocation', 'action_validate', [[allocationId]]);

      return respondSuccess(res, { allocationId, message: 'Leave allocated successfully' });
    } catch (error) {
      console.error('Allocate leave error:', error);
      return respondError(res, error.message, 500);
    }
  };

  /**
   * Get all employees (for allocation management)
   * GET /api/leaves/employees
   */
  getAllEmployees = async (req, res) => {
    try {
      console.log('🔍 getAllEmployees called');

      const employees = await odooAdapter.searchAndReadEmployees(
        [['active', '=', true]],
        { limit: 1000 }
      );

      console.log('✅ Found employees:', employees.length);
      return respondSuccess(res, employees);
    } catch (error) {
      console.error('❌ Get employees error:', error);
      return respondError(res, error.message, 500);
    }
  };

  /**
   * Allocate leave to an employee
   * POST /api/leaves/allocate
   */
  allocateLeave = async (req, res) => {
    try {
      console.log('🔍 allocateLeave called with body:', req.body);

      const { employee_id, leave_type_id, days, start_date, end_date } = req.body;

      if (!employee_id || !leave_type_id || !days) {
        console.log('❌ Missing required fields');
        return respondError(res, 'Missing required fields', 400);
      }

      console.log('📝 Creating allocation in Odoo...');
      const allocationId = await odooAdapter.create('hr.leave.allocation', {
        name: `Leave Allocation ${new Date().toISOString().split('T')[0]}`,
        holiday_status_id: leave_type_id,
        employee_id: employee_id,
        number_of_days: days,
        date_from: start_date,
        date_to: end_date,
        state: 'confirm'
      });

      console.log('✅ Allocation created, ID:', allocationId);
      console.log('📝 Validating allocation...');

      // Validate the allocation
      await odooAdapter.execute('hr.leave.allocation', 'action_validate', [[allocationId]]);

      console.log('✅ Allocation validated successfully');
      return respondSuccess(res, { allocationId, message: 'Leave allocated successfully' });
    } catch (error) {
      console.error('❌ Allocate leave error:', error);
      return respondError(res, error.message, 500);
    }
  };

  /**
   * Get leave balance for specific employee (HR view)
   * GET /api/leaves/employee/:employeeId/balance
   */
  getEmployeeBalance = async (req, res) => {
    try {
      const { employeeId } = req.params;
      const leaveTypeId = req.query.leave_type_id ? parseInt(req.query.leave_type_id) : null;

      console.log(`🔍 Getting balance for employee ${employeeId}, leave type ${leaveTypeId}`);

      if (!leaveTypeId) {
        return respondError(res, 'leave_type_id is required', 400);
      }

      const balance = await odooAdapter.getLeaveBalance(employeeId, leaveTypeId);

      console.log('✅ Balance:', balance);
      return respondSuccess(res, balance);
    } catch (error) {
      console.error('❌ Get employee balance error:', error);
      return respondError(res, error.message, 500);
    }
  };


}

module.exports = new LeaveController();
