const axios = require('axios');

class PowerAutomateService {
  constructor() {
    // Onboarding flows now handled by n8n (was Power Automate)
    this.flowUrl = process.env.N8N_ONBOARDING_WEBHOOK || process.env.PA_ONBOARDING_WEBHOOK;
    this.onboardingInviteUrl = process.env.N8N_ONBOARDING_INVITE_URL || this.flowUrl;
    this.onboardingDecisionUrl = process.env.N8N_ONBOARDING_DECISION_URL || this.flowUrl;
    this.leaveFlowUrl = process.env.POWER_AUTOMATE_LEAVE_FLOW_URL;
    this.managerDecisionFlowUrl = process.env.PA_MANAGER_DECISION_WEBHOOK;
    // [n8n-migration] Expense flows now go to n8n instead of Power Automate
    this.expenseFlowUrl = process.env.N8N_EXPENSE_WEBHOOK_URL;
    this.expenseManagerDecisionUrl = process.env.N8N_MANAGER_DECISION_WEBHOOK;
    this.expenseHrDecisionUrl = process.env.N8N_HR_DECISION_WEBHOOK;
    // Old PA expense URLs (commented out):
    // this.expensePolicyFlowUrl = process.env.POWER_AUTOMATE_EXPENSE_POLICY_FLOW_URL;
    // this.expenseSubmissionFlowUrl = process.env.PA_EXPENSE_SUBMISSION_WEBHOOK;
    // this.expenseApprovalResponseFlowUrl = process.env.PA_EXPENSE_APPROVAL_RESPONSE_WEBHOOK;
  }

  async triggerOnboardingFlow(action, employeeData, metadata = {}) {
    try {
      const payload = {
        action,
        employee: employeeData,
        metadata
      };

      // Route to appropriate n8n flow based on action
      let url;
      if (action === 'initiate') url = this.onboardingInviteUrl;
      else if (action === 'decision') url = this.onboardingDecisionUrl;
      else url = this.flowUrl;

      console.log(`Triggering n8n onboarding flow: ${action}`, employeeData.name);

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000 // 30 second timeout
      });

      console.log(`n8n flow triggered successfully: ${action}`);
      return response.data;

    } catch (error) {
      console.error(`❌ Power Automate error (${action}):`, error.message);
      // Don't throw - we don't want to fail the whole operation if email fails
      return null;
    }
  }

  // Convenience methods
  async sendRegistrationEmail(employeeData) {
    return this.triggerOnboardingFlow('initiate', employeeData);
  }

  async notifyHROfRegistration(employeeData) {
    return this.triggerOnboardingFlow('registered', employeeData);
  }

  async sendApprovalEmail(employeeData, approvalNotes = '') {
    return this.triggerOnboardingFlow('approved', employeeData, { approvalNotes });
  }

  async sendRejectionEmail(employeeData, rejectionReason, rejectionDetails) {
    return this.triggerOnboardingFlow('rejected', employeeData, {
      rejectionReason,
      rejectionDetails
    });
  }

  // ==========================================
  // LEAVE FLOWS (new)
  // ==========================================

  async triggerLeaveFlow(leaveData) {
    try {
      console.log('🔍 DEBUG - Leave Flow URL:', this.leaveFlowUrl); // ADD THIS
      console.log(`🔄 Triggering Leave Flow for ${leaveData.employeeName}`);

      const response = await axios.post(this.leaveFlowUrl, leaveData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      console.log(`✅ Leave flow triggered successfully (status: ${response.status})`);
      return true;

    } catch (error) {
      console.error(`❌ Leave flow error:`, error.message);
      if (error.response) {
        console.error('   Response status:', error.response.status);
        console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }

  async triggerManagerDecisionFlow(decisionData) {
    try {
      console.log(`🔄 Triggering Manager Decision Flow`);

      const response = await axios.post(this.managerDecisionFlowUrl, decisionData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      console.log(`✅ Manager decision flow triggered successfully (status: ${response.status})`);
      return true;

    } catch (error) {
      console.error(`❌ Manager decision flow error:`, error.message);
      if (error.response) {
        console.error('   Response status:', error.response.status);
        console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }

  // ==========================================
  // EXPENSE FLOWS (n8n)
  // ==========================================

  /**
   * Trigger n8n expense intake flow
   * Backend fires this webhook after creating draft expense + uploading invoice.
   * n8n handles everything else: fraud detection, policy check, routing, approvals.
   */
  async triggerExpenseFlow(payload) {
    try {
      if (!this.expenseFlowUrl) {
        console.warn('[ExpenseFlow] N8N_EXPENSE_WEBHOOK_URL not configured in .env');
        return null;
      }

      console.log(`[ExpenseFlow] Triggering n8n expense flow for expense ${payload.expenseId}`);

      const response = await axios.post(this.expenseFlowUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      console.log(`[ExpenseFlow] n8n webhook fired successfully (status: ${response.status})`);
      return response.data;

    } catch (error) {
      console.error(`[ExpenseFlow] n8n webhook error:`, error.message);
      if (error.response) {
        console.error('   Response status:', error.response.status);
        console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }

  async triggerExpenseManagerDecision(payload) {
    try {
      if (!this.expenseManagerDecisionUrl) {
        console.warn('[ExpenseFlow] N8N_MANAGER_DECISION_WEBHOOK not configured in .env');
        return null;
      }

      const response = await axios.get(this.expenseManagerDecisionUrl, {
        params: {
          expenseId: payload.expenseId,
          action: payload.action,
          reason: payload.reason,
          token: payload.token
        },
        timeout: 30000
      });

      console.log(`[ExpenseFlow] Manager decision webhook fired successfully (status: ${response.status})`);
      return true;
    } catch (error) {
      console.error('[ExpenseFlow] Manager decision webhook error:', error.message);
      if (error.response) {
        console.error('   Response status:', error.response.status);
        console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }

  async triggerExpenseHRDecision(payload) {
    try {
      if (!this.expenseHrDecisionUrl) {
        console.warn('[ExpenseFlow] N8N_HR_DECISION_WEBHOOK not configured in .env');
        return null;
      }

      const response = await axios.get(this.expenseHrDecisionUrl, {
        params: {
          expenseId: payload.expenseId,
          action: payload.action,
          reason: payload.reason,
          token: payload.token
        },
        timeout: 30000
      });

      console.log(`[ExpenseFlow] HR decision webhook fired successfully (status: ${response.status})`);
      return true;
    } catch (error) {
      console.error('[ExpenseFlow] HR decision webhook error:', error.message);
      if (error.response) {
        console.error('   Response status:', error.response.status);
        console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }

  // [n8n-migration] Old Power Automate expense methods commented out.
  // triggerExpensePolicyFlow — was called by submitExpense with full fraud payload + policy result
  // triggerApprovalResponseFlow — was called by manager/HR decision endpoints
  /*
  async triggerExpensePolicyFlow(expenseData, policyCheck, employee, manager) { ... }
  async triggerApprovalResponseFlow(decisionData) { ... }
  */
}

module.exports = new PowerAutomateService();
