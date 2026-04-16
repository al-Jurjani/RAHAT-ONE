const { respondError } = require('../utils/responseHandler');
const { query } = require('../db/neon');

const EMPLOYEE_HIDDEN_ACTIONS = [
  'written_to_odoo',
  'fraud_flagged',
  'sent_to_manager',
  'sent_to_hr'
];

const HUMAN_MESSAGES = {
  submitted: 'You submitted a request',
  auto_approved: 'Your request was automatically approved',
  manager_approved: 'Your request was approved by your manager',
  manager_rejected: 'Your request was rejected by your manager',
  hr_approved: 'Your request was approved by HR',
  hr_rejected: 'Your request was rejected by HR',
  fraud_overridden_by_hr: 'HR reviewed and made a decision on your request',
  documents_uploaded: 'You uploaded your documents',
  cnic_verified: 'Your CNIC was verified successfully',
  cnic_failed: 'Your CNIC could not be verified - HR has been notified',
  record_created_in_odoo: 'Your employee record was created',
  onboarding_complete: 'Your onboarding is complete',
  welcome_email_sent: 'Your welcome email was sent'
};

function parseNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizePagination(limitParam, offsetParam) {
  const limit = Math.max(1, Math.min(1000, parseNumber(limitParam, 100)));
  const offset = Math.max(0, parseNumber(offsetParam, 0));
  return { limit, offset };
}

function mapRow(row, humanMessage) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    module: row.module,
    action: row.action,
    actor: row.actor,
    details: row.details,
    createdAt: new Date(row.created_at).toISOString(),
    humanMessage
  };
}

class AuditController {
  async getHrAuditLogs(req, res) {
    try {
      const { module, employeeId, startDate, endDate } = req.query;
      const { limit, offset } = normalizePagination(req.query.limit, req.query.offset);

      const whereClauses = [];
      const values = [];

      if (module) {
        values.push(module);
        whereClauses.push(`module = $${values.length}`);
      }

      if (employeeId) {
        const parsedEmployeeId = parseNumber(employeeId, null);
        if (parsedEmployeeId === null) {
          return respondError(res, 'employeeId must be a valid integer', 400);
        }

        values.push(parsedEmployeeId);
        whereClauses.push(`employee_id = $${values.length}`);
      }

      if (startDate) {
        values.push(startDate);
        whereClauses.push(`created_at >= $${values.length}::timestamptz`);
      }

      if (endDate) {
        values.push(endDate);
        whereClauses.push(`created_at <= $${values.length}::timestamptz`);
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const countResult = await query(
        `SELECT COUNT(*)::int AS total FROM audit_logs ${whereSql}`,
        values
      );

      values.push(limit);
      const limitPosition = values.length;
      values.push(offset);
      const offsetPosition = values.length;

      const logsResult = await query(
        `
          SELECT id, employee_id, employee_name, module, action, actor, details, created_at
          FROM audit_logs
          ${whereSql}
          ORDER BY created_at DESC
          LIMIT $${limitPosition}
          OFFSET $${offsetPosition}
        `,
        values
      );

      return res.status(200).json({
        logs: logsResult.rows.map((row) => mapRow(row, row.action)),
        total: countResult.rows[0].total,
        limit,
        offset
      });
    } catch (error) {
      console.error('getHrAuditLogs error:', error.message);
      return respondError(res, 'Failed to fetch HR audit logs', 500);
    }
  }

  async getEmployeeAuditLogs(req, res) {
    try {
      const employeeId = parseNumber(req.params.employeeId, null);
      if (employeeId === null) {
        return respondError(res, 'employeeId must be a valid integer', 400);
      }

      if (req.user?.role !== 'hr' && req.user?.employee_id !== employeeId) {
        return respondError(res, 'Forbidden', 403);
      }

      const { limit, offset } = normalizePagination(req.query.limit, req.query.offset);

      const countResult = await query(
        `
          SELECT COUNT(*)::int AS total
          FROM audit_logs
          WHERE employee_id = $1
            AND NOT (action = ANY($2))
        `,
        [employeeId, EMPLOYEE_HIDDEN_ACTIONS]
      );

      const logsResult = await query(
        `
          SELECT id, employee_id, employee_name, module, action, actor, details, created_at
          FROM audit_logs
          WHERE employee_id = $1
            AND NOT (action = ANY($2))
          ORDER BY created_at DESC
          LIMIT $3
          OFFSET $4
        `,
        [employeeId, EMPLOYEE_HIDDEN_ACTIONS, limit, offset]
      );

      return res.status(200).json({
        logs: logsResult.rows.map((row) => mapRow(row, HUMAN_MESSAGES[row.action] || row.action)),
        total: countResult.rows[0].total,
        limit,
        offset
      });
    } catch (error) {
      console.error('getEmployeeAuditLogs error:', error.message);
      return respondError(res, 'Failed to fetch employee audit logs', 500);
    }
  }
}

module.exports = new AuditController();
