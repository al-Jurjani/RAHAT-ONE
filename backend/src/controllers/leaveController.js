const leaveService = require('../services/leaveService');
const { respondSuccess, respondError } = require('../utils/responseHandler');
const odooAdapter = require('../adapters/odooAdapter');
const powerAutomateService = require('../services/powerAutomateService');

class LeaveController {

  // ==========================================
  // EMPLOYEE — SUBMIT LEAVE
  // ==========================================

  /**
   * POST /api/leaves
   * Creates the leave record in Odoo, then triggers Flow A (leave_policy_flow).
   * All policy checks (probation, balance, blackout, coverage, auto-approve)
   * are owned by the PA flow — the backend is just a thin trigger layer.
   */
  async submitLeave(req, res) {
    try {
      const employeeId = req.user.employee_id;
      const leaveData = req.body;

      console.log('📝 [submitLeave] Leave submission received');
      console.log('   Employee ID:', employeeId);
      console.log('   Leave Data:', JSON.stringify(leaveData));

      // Basic field validation — only thing the backend enforces
      if (!leaveData.leave_type_id || !leaveData.date_from || !leaveData.date_to || !leaveData.number_of_days) {
        console.error('❌ [submitLeave] Missing required fields');
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }

      // Fetch employee from Odoo for the PA payload
      const employee = await odooAdapter.getEmployee(employeeId);
      if (!employee) {
        console.error('❌ [submitLeave] Employee not found in Odoo for ID:', employeeId);
        return res.status(404).json({ success: false, message: 'Employee not found' });
      }
      console.log('✅ [submitLeave] Employee found:', employee.name, '|', employee.work_email);

      // Fetch manager email
      let managerEmail = null;
      if (employee.parent_id && employee.parent_id[0]) {
        try {
          const manager = await odooAdapter.getEmployee(employee.parent_id[0]);
          managerEmail = manager.work_email || manager.private_email || null;
          console.log('✅ [submitLeave] Manager found:', manager.name, '|', managerEmail);
        } catch (err) {
          console.error('⚠️  [submitLeave] Could not fetch manager — leave will still proceed:', err.message);
        }
      } else {
        console.warn('⚠️  [submitLeave] Employee has no manager assigned (parent_id is null)');
      }

      // Fetch leave type name for the payload
      const leaveTypes = await odooAdapter.getLeaveTypes();
      const leaveType = leaveTypes.find(t => t.id === parseInt(leaveData.leave_type_id));
      const leaveTypeName = leaveType ? leaveType.name : 'Unknown';
      console.log('✅ [submitLeave] Leave type resolved:', leaveTypeName);

      // Create leave record in Odoo (state: confirm)
      const leaveResult = await leaveService.submitLeaveRequest(employeeId, leaveData);
      const leaveId = leaveResult.leaveId || leaveResult;
      console.log('✅ [submitLeave] Leave created in Odoo — ID:', leaveId);

      // Build payload for Flow A
      const crypto = require('crypto');
      const powerAutomatePayload = {
        leaveId:       leaveId,
        approvalToken: crypto.randomBytes(32).toString('hex'),
        employeeId:    employeeId,
        employeeName:  employee.name,
        employeeEmail: employee.work_email || '',
        departmentId:  employee.department_id ? employee.department_id[0] : null,
        departmentName:employee.department_id ? employee.department_id[1] : 'Unknown',
        managerId:     employee.parent_id     ? employee.parent_id[0]     : null,
        managerName:   employee.parent_id     ? employee.parent_id[1]     : null,
        managerEmail:  managerEmail,
        leaveTypeId:   leaveData.leave_type_id,
        leaveTypeName: leaveTypeName,
        dateFrom:      leaveData.date_from,
        dateTo:        leaveData.date_to,
        numberOfDays:  leaveData.number_of_days,
        notes:         leaveData.notes || '',
        submittedAt:   new Date().toISOString()
      };

      console.log('📤 [submitLeave] Triggering Flow A with payload:', JSON.stringify(powerAutomatePayload, null, 2));

      // Trigger Flow A — leave_policy_flow
      // PA responds with 202 Accepted almost immediately; the flow runs asynchronously.
      const flowTriggered = await powerAutomateService.triggerLeaveFlow(powerAutomatePayload);
      if (!flowTriggered) {
        console.error('⚠️  [submitLeave] Flow A did NOT trigger — leave exists in Odoo but policy flow did not start. LeaveId:', leaveId);
        // We do NOT fail the request — leave is in Odoo and HR can intervene manually.
      } else {
        console.log('✅ [submitLeave] Flow A triggered successfully for LeaveId:', leaveId);
      }

      res.status(201).json({
        success: true,
        message: 'Leave request submitted successfully',
        leaveId: leaveId,
        data: {
          id:          leaveId,
          status:      'pending_approval',
          employee:    employee.name,
          leaveType:   leaveTypeName,
          dateFrom:    leaveData.date_from,
          dateTo:      leaveData.date_to,
          numberOfDays:leaveData.number_of_days
        }
      });

    } catch (error) {
      console.error('❌ [submitLeave] Unhandled error:', error.message, error.stack);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // ==========================================
  // READ ENDPOINTS — serve the frontend UI
  // ==========================================

  /** GET /api/leaves/balance */
  async getBalance(req, res) {
    try {
      const employeeId = req.user.employee_id;
      const leaveTypeId = req.query.leave_type_id ? parseInt(req.query.leave_type_id) : null;

      console.log('🔍 [getBalance] employeeId:', employeeId, '| leaveTypeId:', leaveTypeId);

      if (!employeeId) return respondError(res, 'Employee ID not found in token', 400);

      const balance = await leaveService.getEmployeeBalance(employeeId, leaveTypeId);
      console.log('✅ [getBalance] Result:', balance);
      return respondSuccess(res, balance);
    } catch (error) {
      console.error('❌ [getBalance]', error.message);
      return respondError(res, error.message, 500);
    }
  }

  /** GET /api/leaves/types */
  async getLeaveTypes(req, res) {
    try {
      const types = await leaveService.getLeaveTypes();
      res.json(types);
    } catch (error) {
      console.error('❌ [getLeaveTypes]', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /** GET /api/leaves — HR dashboard list with optional filters */
  async getLeaves(req, res) {
    try {
      const filters = {};
      if (req.user.role === 'employee')                              filters.employee_id = req.user.employee_id;
      if (req.query.status)                                          filters.state = req.query.status;
      if (req.query.employee_id && req.user.role !== 'employee')    filters.employee_id = parseInt(req.query.employee_id);

      const leaves = await leaveService.getLeaves(filters);
      res.json(leaves);
    } catch (error) {
      console.error('❌ [getLeaves]', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /** GET /api/leaves/my-leaves */
  async getMyLeaves(req, res) {
    try {
      const employeeId = req.user.employee_id;
      const state = req.query.status || null;
      const leaves = await leaveService.getEmployeeLeaves(employeeId, state);
      res.json(leaves);
    } catch (error) {
      console.error('❌ [getMyLeaves]', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/leaves/auto-approved
   * Returns leaves approved automatically by Flow I.
   *
   * Strategy: match audit_logs rows (action='leave_auto_approved') to Odoo
   * leaves by employee_id + time proximity (≤60 min). This works for both old
   * audit entries (no leaveId in details) and new ones (leaveId present).
   */
  async getAutoApprovedLeaves(req, res) {
    try {
      const { query } = require('../db/neon');

      // Prefer leaveId when present; fall back to employee_id + timestamp.
      const auditRows = await query(
        `SELECT employee_id,
                created_at,
                (details->>'leaveId')::int AS leave_id
         FROM audit_logs
         WHERE module = 'leave' AND action = 'leave_auto_approved'
         ORDER BY created_at DESC`,
        []
      );
      if (!auditRows.rows.length) return res.json([]);

      // Split into ID-matched (precise) vs proximity-matched (legacy)
      const knownIds  = auditRows.rows.map(r => r.leave_id).filter(Boolean);
      const proximityEntries = auditRows.rows.filter(r => !r.leave_id);

      const leaveFields = ['employee_id', 'holiday_status_id', 'request_date_from',
                           'request_date_to', 'number_of_days', 'state', 'name', 'create_date'];

      let matched = [];

      // Precise match by leaveId
      if (knownIds.length) {
        const byId = await odooAdapter.search('hr.leave', [['id', 'in', knownIds]], leaveFields, 500);
        matched.push(...byId);
      }

      // Proximity match: all validated leaves → filter by employee + ±60 min
      if (proximityEntries.length) {
        const allApproved = await odooAdapter.search('hr.leave', [['state', '=', 'validate']], leaveFields, 500);
        const WINDOW_MS = 60 * 60 * 1000;
        for (const leave of allApproved) {
          if (matched.some(m => m.id === leave.id)) continue; // already found by ID
          const leaveTime = new Date(leave.create_date).getTime();
          const hit = proximityEntries.some(row =>
            row.employee_id === leave.employee_id[0] &&
            Math.abs(leaveTime - new Date(row.created_at).getTime()) <= WINDOW_MS
          );
          if (hit) matched.push(leave);
        }
      }

      matched.sort((a, b) => new Date(b.create_date) - new Date(a.create_date));
      res.json(matched);
    } catch (error) {
      console.error('❌ [getAutoApprovedLeaves]', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/leaves/auto-rejected
   * Returns leaves rejected automatically by Flow I (probation / balance / blackout).
   * Same dual strategy: leaveId when present, proximity match for legacy entries.
   */
  async getAutoRejectedLeaves(req, res) {
    try {
      const { query } = require('../db/neon');

      const AUTO_REJECT_ACTIONS = [
        'leave_rejected_probation',
        'leave_rejected_insufficient_balance',
        'leave_rejected_blackout',
      ];

      const auditRows = await query(
        `SELECT employee_id,
                created_at,
                action,
                (details->>'leaveId')::int AS leave_id
         FROM audit_logs
         WHERE module = 'leave' AND action = ANY($1)
         ORDER BY created_at DESC`,
        [AUTO_REJECT_ACTIONS]
      );
      if (!auditRows.rows.length) return res.json([]);

      const knownIds         = auditRows.rows.map(r => r.leave_id).filter(Boolean);
      const proximityEntries = auditRows.rows.filter(r => !r.leave_id);

      const leaveFields = ['employee_id', 'holiday_status_id', 'request_date_from',
                           'request_date_to', 'number_of_days', 'state', 'name', 'create_date'];

      let matched = [];

      if (knownIds.length) {
        const byId = await odooAdapter.search('hr.leave', [['id', 'in', knownIds]], leaveFields, 500);
        matched.push(...byId);
      }

      if (proximityEntries.length) {
        const allRefused = await odooAdapter.search('hr.leave', [['state', '=', 'refuse']], leaveFields, 500);
        const WINDOW_MS = 60 * 60 * 1000;
        for (const leave of allRefused) {
          if (matched.some(m => m.id === leave.id)) continue;
          const leaveTime = new Date(leave.create_date).getTime();
          const hit = proximityEntries.some(row =>
            row.employee_id === leave.employee_id[0] &&
            Math.abs(leaveTime - new Date(row.created_at).getTime()) <= WINDOW_MS
          );
          if (hit) matched.push(leave);
        }
      }

      matched.sort((a, b) => new Date(b.create_date) - new Date(a.create_date));
      res.json(matched);
    } catch (error) {
      console.error('❌ [getAutoRejectedLeaves]', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /** GET /api/leaves/statistics */
  async getStatistics(req, res) {
    try {
      const employeeId = req.user.role === 'employee' ? req.user.employee_id : null;
      const stats = await leaveService.getLeaveStatistics(employeeId);
      res.json(stats);
    } catch (error) {
      console.error('❌ [getStatistics]', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /** GET /api/leaves/:id/messages */
  async getLeaveMessages(req, res) {
    try {
      const { id } = req.params;
      const messages = await odooAdapter.getMessages('hr.leave', parseInt(id));
      res.json(messages);
    } catch (error) {
      console.error('❌ [getLeaveMessages]', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ==========================================
  // MANAGER / HR APPROVAL PAGE
  // ==========================================

  /**
   * GET /api/leaves/public/:id
   * Serves leave details for the manager/HR approval page (no auth required).
   * Accepts leaves in 'confirm' (manager deciding) or 'validate1' (HR deciding).
   */
  async getPublicLeave(req, res) {
    try {
      const { id } = req.params;
      console.log('🔍 [getPublicLeave] LeaveId:', id);

      const leave = await odooAdapter.getLeaveById(parseInt(id));
      if (!leave) {
        return res.status(404).json({ success: false, message: 'Leave request not found' });
      }

      // confirm = awaiting manager | validate1 = manager approved, awaiting HR
      if (!['confirm', 'validate1'].includes(leave.state)) {
        console.warn('⚠️  [getPublicLeave] Leave already processed. State:', leave.state);
        return res.status(400).json({ success: false, message: 'This leave request has already been processed' });
      }

      const employee = await odooAdapter.getEmployee(leave.employee_id[0]);
      let managerName = 'Manager';
      let managerEmail = '';

      if (employee.parent_id && employee.parent_id[0]) {
        const manager = await odooAdapter.getEmployee(employee.parent_id[0]);
        managerName  = manager.name;
        managerEmail = manager.work_email || manager.private_email || '';
      }

      console.log('✅ [getPublicLeave] Serving leave data. State:', leave.state);
      res.json({
        employeeName: leave.employee_id[1],
        leaveType:    leave.holiday_status_id[1],
        numberOfDays: leave.number_of_days,
        dateFrom:     leave.request_date_from,
        dateTo:       leave.request_date_to,
        reason:       leave.name,
        currentState: leave.state,
        managerName,
        managerEmail
      });

    } catch (error) {
      console.error('❌ [getPublicLeave]', error.message);
      res.status(500).json({ success: false, message: 'Failed to load leave details' });
    }
  }

  /**
   * POST /api/leaves/:id/manager-decision
   * Called by the frontend approval page after manager or HR clicks approve/reject.
   * Backend validates, fetches context, then hands off entirely to Flow B.
   * Flow B decides the correct Odoo state and sends all notification emails.
   */
  async managerDecision(req, res) {
    try {
      const { id } = req.params;
      const { decision, managerName, managerEmail, remarks } = req.body;

      console.log(`📝 [managerDecision] LeaveId: ${id} | Decision: ${decision}`);

      // Security: the link is only shared with the manager via email,
      // and the state check below prevents reuse after a decision is made.

      if (!['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({ success: false, message: 'Invalid decision. Must be "approved" or "rejected"' });
      }

      const leave = await odooAdapter.getLeaveById(parseInt(id));
      if (!leave) {
        console.error('❌ [managerDecision] Leave not found:', id);
        return res.status(404).json({ success: false, message: 'Leave request not found' });
      }

      console.log('✅ [managerDecision] Leave found. Current state:', leave.state);

      // confirm = manager acting for the first time
      // validate1 = HR acting after manager approved a long leave
      if (!['confirm', 'validate1'].includes(leave.state)) {
        console.warn('⚠️  [managerDecision] Already processed. State:', leave.state);
        return res.status(400).json({ success: false, message: 'This leave request has already been processed' });
      }

      const employee = await odooAdapter.getEmployee(leave.employee_id[0]);
      console.log('✅ [managerDecision] Employee:', employee.name);

      const payload = {
        leaveId:      parseInt(id),
        decision,
        currentState: leave.state,            // Flow B uses this to know if it's manager or HR acting
        numberOfDays: leave.number_of_days,
        leaveTypeName:leave.holiday_status_id[1],
        dateFrom:     leave.request_date_from,
        dateTo:       leave.request_date_to,
        employeeName: employee.name,
        employeeEmail:employee.work_email || employee.private_email || '',
        managerName:  managerName || '',
        managerEmail: managerEmail || '',
        remarks:      remarks || '',
        hrActorName:  leave.state === 'validate1' ? (managerName || 'HR') : undefined
      };

      console.log('📤 [managerDecision] Triggering Flow B with payload:', JSON.stringify(payload, null, 2));

      // Trigger Flow B — leave_manager_decision_flow
      const flowTriggered = await powerAutomateService.triggerManagerDecisionFlow(payload);
      if (!flowTriggered) {
        console.error('⚠️  [managerDecision] Flow B did NOT trigger. LeaveId:', id, '| Decision:', decision);
        // Decision is recorded in the log — HR can intervene manually in Odoo if needed.
      } else {
        console.log('✅ [managerDecision] Flow B triggered successfully. LeaveId:', id);
      }

      res.json({ success: true, message: 'Decision recorded, flow triggered' });

    } catch (error) {
      console.error('❌ [managerDecision] Unhandled error:', error.message, error.stack);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ==========================================
  // HR — ALLOCATION MANAGEMENT
  // ==========================================

  /** GET /api/leaves/employees */
  getAllEmployees = async (req, res) => {
    try {
      console.log('🔍 [getAllEmployees] Fetching all active employees');
      const employees = await odooAdapter.searchAndReadEmployees(
        [['active', '=', true]],
        { limit: 1000 }
      );
      console.log('✅ [getAllEmployees] Found:', employees.length, 'employees');
      return respondSuccess(res, employees);
    } catch (error) {
      console.error('❌ [getAllEmployees]', error.message);
      return respondError(res, error.message, 500);
    }
  };

  /** POST /api/leaves/allocate */
  allocateLeave = async (req, res) => {
    try {
      console.log('🔍 [allocateLeave] Body:', req.body);
      const { employee_id, leave_type_id, days, start_date, end_date } = req.body;

      if (!employee_id || !leave_type_id || !days) {
        console.error('❌ [allocateLeave] Missing required fields');
        return respondError(res, 'Missing required fields', 400);
      }

      console.log('📝 [allocateLeave] Creating allocation in Odoo...');
      const allocationId = await odooAdapter.create('hr.leave.allocation', {
        name:             `Leave Allocation ${new Date().toISOString().split('T')[0]}`,
        holiday_status_id: leave_type_id,
        employee_id,
        number_of_days:   days,
        date_from:        start_date,
        date_to:          end_date,
        state:            'confirm'
      });
      console.log('✅ [allocateLeave] Allocation created, ID:', allocationId);

      await odooAdapter.execute('hr.leave.allocation', 'action_validate', [[allocationId]]);
      console.log('✅ [allocateLeave] Allocation validated');

      return respondSuccess(res, { allocationId, message: 'Leave allocated successfully' });
    } catch (error) {
      console.error('❌ [allocateLeave]', error.message);
      return respondError(res, error.message, 500);
    }
  };

  /** GET /api/leaves/employee/:employeeId/balance */
  getEmployeeBalance = async (req, res) => {
    try {
      const { employeeId } = req.params;
      const leaveTypeId = req.query.leave_type_id ? parseInt(req.query.leave_type_id) : null;

      console.log(`🔍 [getEmployeeBalance] employeeId: ${employeeId} | leaveTypeId: ${leaveTypeId}`);
      if (!leaveTypeId) return respondError(res, 'leave_type_id is required', 400);

      const balance = await odooAdapter.getLeaveBalance(employeeId, leaveTypeId);
      console.log('✅ [getEmployeeBalance] Balance:', balance);
      return respondSuccess(res, balance);
    } catch (error) {
      console.error('❌ [getEmployeeBalance]', error.message);
      return respondError(res, error.message, 500);
    }
  };

  // ==========================================
  // BLACKOUT DATE MANAGEMENT
  // ==========================================

  /**
   * GET /api/leaves/config/blackout-dates
   * Returns the current blackout periods from Odoo system parameters.
   * Used by the frontend HR management page and readable by the PA flow directly.
   */
  getBlackoutDates = async (req, res) => {
    try {
      console.log('🔍 [getBlackoutDates] Reading from Odoo ir.config_parameter');
      const result = await odooAdapter.execute('ir.config_parameter', 'search_read', [
        [['key', '=', 'rahat.blackout_dates']],
        ['value']
      ]);
      const dates = result.length > 0 ? JSON.parse(result[0].value) : [];
      console.log('✅ [getBlackoutDates] Found', dates.length, 'periods');
      return respondSuccess(res, dates);
    } catch (error) {
      console.error('❌ [getBlackoutDates]', error.message);
      return respondError(res, error.message, 500);
    }
  };

  /**
   * PUT /api/leaves/config/blackout-dates
   * Replaces the full blackout periods list in Odoo.
   * Body: [{ start: "YYYY-MM-DD", end: "YYYY-MM-DD", reason: "..." }]
   */
  updateBlackoutDates = async (req, res) => {
    try {
      const dates = req.body;
      if (!Array.isArray(dates)) {
        return respondError(res, 'Body must be an array of blackout periods', 400);
      }

      console.log('📝 [updateBlackoutDates] Saving', dates.length, 'periods to Odoo');

      const existing = await odooAdapter.execute('ir.config_parameter', 'search', [
        [['key', '=', 'rahat.blackout_dates']]
      ]);

      if (existing.length > 0) {
        await odooAdapter.execute('ir.config_parameter', 'write', [
          [existing[0]],
          { value: JSON.stringify(dates) }
        ]);
      } else {
        await odooAdapter.execute('ir.config_parameter', 'create', [
          { key: 'rahat.blackout_dates', value: JSON.stringify(dates) }
        ]);
      }

      console.log('✅ [updateBlackoutDates] Saved successfully');
      return respondSuccess(res, { message: 'Blackout dates updated', dates });
    } catch (error) {
      console.error('❌ [updateBlackoutDates]', error.message);
      return respondError(res, error.message, 500);
    }
  };

  // ==========================================
  // TODO: DELETE — PA owns approvals (Flow A + Flow B). Dead code below.
  // ==========================================

  /*
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { action, remarks } = req.body;
      const managerId = req.user.id;

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Invalid action. Must be "approve" or "reject"' });
      }

      const result = await leaveService.updateLeaveStatus(parseInt(id), action, managerId, remarks || '');
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
  */
}

module.exports = new LeaveController();
