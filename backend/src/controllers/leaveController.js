const leaveService = require('../services/leaveService');
const { respondSuccess, respondError } = require('../utils/responseHandler');
const odooAdapter = require('../adapters/odooAdapter');
const powerAutomateService = require('../services/powerAutomateService');

class LeaveController {
  /**
   * POST /api/leaves
   * Submit a new leave request
   */
  async submitLeave(req, res) {
    try {
      const employeeId = req.user.employee_id;
      const leaveData = req.body;

      console.log('📝 Leave submission received');
      console.log('   Employee ID:', employeeId);
      console.log('   Leave Data:', leaveData);

      // Validate required fields
      if (!leaveData.leave_type_id || !leaveData.date_from || !leaveData.date_to || !leaveData.number_of_days) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      // Get employee details for Power Automate
      const employee = await odooAdapter.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      console.log('   Employee details:', employee.name, employee.work_email);

      // Get manager email if manager exists
      let managerEmail = null;
      if (employee.parent_id && employee.parent_id[0]) {
        try {
          const manager = await odooAdapter.getEmployee(employee.parent_id[0]);
          managerEmail = manager.work_email || manager.private_email || 'sigh.and.wave@gmail.com'; // Fallback to your email
          console.log('   Manager details:', manager.name, managerEmail);
        } catch (err) {
          console.error('   ⚠️  Could not fetch manager details:', err.message);
          managerEmail = 'sigh.and.wave@gmail.com'; // Fallback
        }
      }

      // Get leave type name
      const leaveTypes = await odooAdapter.getLeaveTypes();
      const leaveType = leaveTypes.find(t => t.id === parseInt(leaveData.leave_type_id));
      const leaveTypeName = leaveType ? leaveType.name : 'Unknown';

      console.log('   Leave type:', leaveTypeName);

      // Create leave request in Odoo first (state = draft)
      const leaveResult = await leaveService.submitLeaveRequest(employeeId, leaveData);
      const leaveId = leaveResult.leaveId || leaveResult;  // Extract actual ID
      console.log('✅ Leave created in Odoo with ID:', leaveId);

      // Generate approval token (simple approach for FYP)
      const crypto = require('crypto');
      const approvalToken = crypto.randomBytes(32).toString('hex');

      // Prepare payload for Power Automate
      const powerAutomatePayload = {
        leaveId: leaveId,
        approvalToken: approvalToken,
        employeeId: employeeId,
        employeeName: employee.name,
        employeeEmail: employee.work_email,
        departmentId: employee.department_id ? employee.department_id[0] : null,
        departmentName: employee.department_id ? employee.department_id[1] : 'Unknown',
        managerId: employee.parent_id ? employee.parent_id[0] : null,
        managerName: employee.parent_id ? employee.parent_id[1] : null,
        managerEmail: managerEmail,
        leaveTypeId: leaveData.leave_type_id,
        leaveTypeName: leaveTypeName,
        dateFrom: leaveData.date_from,
        dateTo: leaveData.date_to,
        numberOfDays: leaveData.number_of_days,
        notes: leaveData.notes || '',
        submittedAt: new Date().toISOString()
      };

      console.log('📤 Sending to Power Automate:', powerAutomatePayload);

      // // TODO: Trigger Power Automate flow
      // // For now, we'll add this endpoint in next chunk
      // const flowUrl = process.env.POWER_AUTOMATE_LEAVE_FLOW_URL;

      // if (flowUrl) {
      //   try {
      //     const axios = require('axios');
      //     const flowResponse = await axios.post(flowUrl, powerAutomatePayload, {
      //       headers: { 'Content-Type': 'application/json' },
      //       timeout: 10000 // 10 second timeout
      //     });
      //     console.log('✅ Power Automate triggered successfully:', flowResponse.status);
      //   } catch (flowError) {
      //     console.error('⚠️  Power Automate trigger failed:', flowError.message);
      //     // Don't fail the request - leave is already created in Odoo
      //     // Flow can be triggered manually or retried
      //   }
      // } else {
      //   console.log('⚠️  Power Automate URL not configured, skipping flow trigger');
      // }

      // Trigger Power Automate flow using service
      await powerAutomateService.triggerLeaveFlow(powerAutomatePayload);

      res.status(201).json({
        success: true,
        message: 'Leave request submitted successfully',
        leaveId: leaveId,
        data: {
          id: leaveId,
          status: 'pending_approval',
          employee: employee.name,
          leaveType: leaveTypeName,
          dateFrom: leaveData.date_from,
          dateTo: leaveData.date_to,
          numberOfDays: leaveData.number_of_days
        }
      });

    } catch (error) {
      console.error('❌ Leave submission error:', error);
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

  /**
   * POST /api/leaves/:id/manager-decision
   * Record manager's approval/rejection decision
   * Called by Power Automate after manager responds
   */
  async managerDecision(req, res) {
  try {
    const { id } = req.params;
    const { decision, managerName, managerEmail, remarks } = req.body;

    console.log(`📝 Manager decision for leave ${id}:`, decision);

    // Validate decision
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision'
      });
    }

    // Get leave details
    const leave = await odooAdapter.getLeaveById(parseInt(id));
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Check if already processed
    if (leave.state !== 'confirm') {
      return res.status(400).json({
        success: false,
        message: 'This leave request has already been processed'
      });
    }

    // Get employee details for notifications
    const employee = await odooAdapter.getEmployee(leave.employee_id[0]);

    // Update Odoo status FIRST
    if (decision === 'rejected') {
      // Rejected - update to refuse
      await odooAdapter.updateLeaveStatus(parseInt(id), 'refuse', remarks);

    } else if (decision === 'approved') {
      // Approved by manager
      if (leave.number_of_days <= 3) {
        // Short leave - final approval (validate)
        await odooAdapter.updateLeaveStatus(parseInt(id), 'validate', remarks || 'Manager approved');
      } else {
        // Long leave - needs HR approval, set to 'validate1' (manager approved, pending HR)
        await odooAdapter.updateLeaveStatus(parseInt(id), 'validate1', remarks || 'Manager approved - pending HR');
      }
    }

    // THEN post message to chatter with the decision
    const messageBody = decision === 'approved'
      ? `✅ <strong>Manager Approved</strong> by ${managerName} (${managerEmail})<br/>Remarks: ${remarks || 'None'}`
      : `❌ <strong>Manager Rejected</strong> by ${managerName} (${managerEmail})<br/>Reason: ${remarks || 'No reason provided'}`;

    await odooAdapter.postMessage('hr.leave', parseInt(id), messageBody);

    // Trigger Power Automate to send notification emails
    const payload = {
      leaveId: parseInt(id),
      decision: decision,
      employeeName: employee.name,
      employeeEmail: employee.work_email || employee.private_email || 'employee@example.com',
      leaveTypeName: leave.holiday_status_id[1],
      numberOfDays: leave.number_of_days,
      dateFrom: leave.request_date_from,
      dateTo: leave.request_date_to,
      managerName: managerName,
      managerEmail: managerEmail,
      remarks: remarks || (decision === 'approved' ? 'No comments' : 'No reason provided'),
      requiresHRApproval: leave.number_of_days > 3 // Flag for PA to know if HR step needed
    };

    console.log('📤 Triggering manager decision flow:', payload);
    await powerAutomateService.triggerManagerDecisionFlow(payload);

    res.json({
      success: true,
      message: `Leave ${decision} successfully`,
      requiresHRApproval: leave.number_of_days > 3
    });

  } catch (error) {
    console.error('❌ Manager decision error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

  /**
   * GET /api/leaves/:id/messages
   * Get messages/notes for a leave request
   */
  async getLeaveMessages(req, res) {
    try {
      const { id } = req.params;
      const messages = await odooAdapter.getMessages('hr.leave', parseInt(id));
      res.json(messages);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getPublicLeave(req, res) {
  try {
    const { id } = req.params;

    const leave = await odooAdapter.getLeaveById(parseInt(id));

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (leave.state !== 'confirm') {
      return res.status(400).json({
        success: false,
        message: 'This leave request has already been processed'
      });
    }

    const employee = await odooAdapter.getEmployee(leave.employee_id[0]);
    let managerName = 'Manager';
    let managerEmail = '';

    if (employee.parent_id && employee.parent_id[0]) {
      const manager = await odooAdapter.getEmployee(employee.parent_id[0]);
      managerName = manager.name;
      managerEmail = manager.work_email || manager.private_email;
    }

    res.json({
      employeeName: leave.employee_id[1],
      leaveType: leave.holiday_status_id[1],
      numberOfDays: leave.number_of_days,
      dateFrom: leave.request_date_from,
      dateTo: leave.request_date_to,
      reason: leave.name,
      managerName: managerName,
      managerEmail: managerEmail
    });
  } catch (error) {
    console.error('❌ Get public leave error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load leave details'
    });
  }
}
}

module.exports = new LeaveController();
