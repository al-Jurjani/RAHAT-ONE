const odooAdapter = require('../adapters/odooAdapter');
const { respondSuccess, respondError } = require('../utils/responseHandler');

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function toDate(value) {
  return value ? new Date(value) : new Date(0);
}

function hoursAgo(hours) {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return toIsoDate(date);
}

function normalizeStatus(status) {
  if (!status) {
    return 'pending';
  }
  return String(status).toLowerCase();
}

class HRDashboardController {
  async getDashboardSummary(req, res) {
    try {
      if (req.user?.role !== 'hr') {
        return respondError(res, 'Forbidden', 403);
      }

      const now = new Date();
      const todayStr = toIsoDate(now);
      const staleThreshold = hoursAgo(48);

      const day = now.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + mondayOffset);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const [
        onboardingPending,
        activeOnboardings,
        leavePending,
        leavesThisWeek,
        expensesPending,
        fraudFlagsToday,
        flaggedExpenses,
        staleLeaves,
        stalledOnboardings,
        recentLeaves,
        recentExpenses,
        recentOnboardings
      ] = await Promise.all([
        odooAdapter.execute('hr.employee', 'search_count', [[
          ['onboarding_status', 'in', ['documents_submitted', 'verification_pending', 'registered']]
        ]]),
        odooAdapter.execute('hr.employee', 'search_count', [[
          ['onboarding_status', 'in', ['initiated', 'documents_submitted', 'verification_pending']]
        ]]),
        odooAdapter.execute('hr.leave', 'search_count', [[
          ['state', 'in', ['confirm', 'validate1']]
        ]]),
        odooAdapter.execute('hr.leave', 'search_count', [[
          ['request_date_from', '<=', toIsoDate(weekEnd)],
          ['request_date_to', '>=', toIsoDate(weekStart)],
          ['state', 'in', ['confirm', 'validate1', 'validate']]
        ]]),
        odooAdapter.execute('hr.expense', 'search_count', [[
          ['workflow_status', 'in', ['draft', 'pending_manager', 'pending_hr', 'pending_manager_approval', 'pending_hr_approval', 'submitted', 'in_review']]
        ]]),
        odooAdapter.execute('hr.expense', 'search_count', [[
          ['fraud_detection_status', 'in', ['fraudulent', 'suspicious']],
          ['create_date', '>=', `${todayStr} 00:00:00`]
        ]]),
        odooAdapter.execute('hr.expense', 'search_read', [[
          ['fraud_detection_status', 'in', ['fraudulent', 'suspicious']]
        ], ['id', 'employee_id', 'total_amount', 'workflow_status', 'fraud_detection_status', 'create_date'], 0, 10, 'create_date desc']),
        odooAdapter.execute('hr.leave', 'search_read', [[
          ['state', 'in', ['confirm', 'validate1']],
          ['create_date', '<=', `${staleThreshold} 00:00:00`]
        ], ['id', 'employee_id', 'state', 'create_date', 'request_date_from', 'request_date_to'], 0, 10, 'create_date asc']),
        odooAdapter.execute('hr.employee', 'search_read', [[
          ['onboarding_status', 'in', ['documents_submitted', 'verification_pending', 'registered']],
          ['create_date', '<=', `${staleThreshold} 00:00:00`]
        ], ['id', 'name', 'onboarding_status', 'create_date'], 0, 10, 'create_date asc']),
        odooAdapter.execute('hr.leave', 'search_read', [[
          ['id', '!=', 0]
        ], ['id', 'employee_id', 'state', 'create_date', 'request_date_from', 'request_date_to'], 0, 4, 'create_date desc']),
        odooAdapter.execute('hr.expense', 'search_read', [[
          ['id', '!=', 0]
        ], ['id', 'employee_id', 'workflow_status', 'total_amount', 'create_date'], 0, 4, 'create_date desc']),
        odooAdapter.execute('hr.employee', 'search_read', [[
          ['id', '!=', 0]
        ], ['id', 'name', 'onboarding_status', 'create_date'], 0, 4, 'create_date desc'])
      ]);

      const needsAttention = [];

      flaggedExpenses.forEach((expense) => {
        needsAttention.push({
          type: 'expense',
          severity: expense.fraud_detection_status === 'fraudulent' ? 'high' : 'medium',
          title: `Fraud flag on expense #${expense.id}`,
          subtitle: `${expense.employee_id?.[1] || 'Employee'} • PKR ${expense.total_amount || 0}`,
          status: normalizeStatus(expense.workflow_status || expense.fraud_detection_status),
          date: expense.create_date
        });
      });

      staleLeaves.forEach((leave) => {
        needsAttention.push({
          type: 'leave',
          severity: 'medium',
          title: `Pending leave #${leave.id} over 48h`,
          subtitle: `${leave.employee_id?.[1] || 'Employee'} • ${leave.request_date_from || '-'} to ${leave.request_date_to || '-'}`,
          status: normalizeStatus(leave.state),
          date: leave.create_date
        });
      });

      stalledOnboardings.forEach((employee) => {
        needsAttention.push({
          type: 'onboarding',
          severity: 'medium',
          title: `Onboarding stalled for ${employee.name}`,
          subtitle: `Status: ${employee.onboarding_status || 'pending'}`,
          status: normalizeStatus(employee.onboarding_status),
          date: employee.create_date
        });
      });

      const recentActivity = [];

      recentLeaves.forEach((leave) => {
        recentActivity.push({
          type: 'leave',
          title: `Leave #${leave.id}`,
          subtitle: `${leave.employee_id?.[1] || 'Employee'} • ${leave.request_date_from || '-'} to ${leave.request_date_to || '-'}`,
          status: normalizeStatus(leave.state),
          date: leave.create_date
        });
      });

      recentExpenses.forEach((expense) => {
        recentActivity.push({
          type: 'expense',
          title: `Expense #${expense.id}`,
          subtitle: `${expense.employee_id?.[1] || 'Employee'} • PKR ${expense.total_amount || 0}`,
          status: normalizeStatus(expense.workflow_status),
          date: expense.create_date
        });
      });

      recentOnboardings.forEach((employee) => {
        recentActivity.push({
          type: 'onboarding',
          title: `Onboarding ${employee.name}`,
          subtitle: `Status: ${employee.onboarding_status || 'pending'}`,
          status: normalizeStatus(employee.onboarding_status),
          date: employee.create_date
        });
      });

      const sortedNeedsAttention = needsAttention
        .sort((a, b) => toDate(a.date) - toDate(b.date))
        .slice(0, 12);

      const sortedRecentActivity = recentActivity
        .sort((a, b) => toDate(b.date) - toDate(a.date))
        .slice(0, 10);

      return respondSuccess(res, {
        counts: {
          totalPendingApprovals: onboardingPending + leavePending + expensesPending,
          fraudFlagsToday,
          activeOnboardings,
          leavesThisWeek,
          onboardingPending,
          leavePending,
          expensePending: expensesPending
        },
        needsAttention: sortedNeedsAttention,
        recentActivity: sortedRecentActivity
      }, 'HR dashboard summary fetched');
    } catch (error) {
      console.error('getDashboardSummary error:', error);
      return respondError(res, 'Failed to fetch dashboard summary', 500);
    }
  }
}

module.exports = new HRDashboardController();
