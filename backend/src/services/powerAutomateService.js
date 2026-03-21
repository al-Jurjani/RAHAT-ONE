const axios = require('axios');

class PowerAutomateService {
  constructor() {
    this.flowUrl = process.env.PA_ONBOARDING_WEBHOOK;
    this.leaveFlowUrl = process.env.POWER_AUTOMATE_LEAVE_FLOW_URL;
    this.managerDecisionFlowUrl = process.env.PA_MANAGER_DECISION_WEBHOOK;
    this.expensePolicyFlowUrl = process.env.POWER_AUTOMATE_EXPENSE_POLICY_FLOW_URL;
    this.expenseSubmissionFlowUrl = process.env.PA_EXPENSE_SUBMISSION_WEBHOOK;
    this.expenseApprovalResponseFlowUrl = process.env.PA_EXPENSE_APPROVAL_RESPONSE_WEBHOOK;
  }

  async triggerOnboardingFlow(action, employeeData, metadata = {}) {
    try {
      const payload = {
        action,
        employee: employeeData,
        metadata
      };

      console.log(`🔄 Triggering Power Automate: ${action}`, employeeData.name);

      const response = await axios.post(this.flowUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000 // 30 second timeout
      });

      console.log(`✅ Power Automate triggered successfully: ${action}`);
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
  // EXPENSE FLOWS (new)
  // ==========================================

  /**
   * Trigger expense policy flow
   * Handles policy validation and sends appropriate notifications (approval to manager or rejection to employee)
   */
  async triggerExpensePolicyFlow(expenseData, policyCheck, employee, manager) {
    try {
      if (!this.expensePolicyFlowUrl) {
        console.warn('⚠️  Power Automate expense policy flow URL not configured');
        return null;
      }

      const payload = {
        expenseId: expenseData.expenseId,
        employeeId: expenseData.employeeId,
        employeeName: employee.name,
        employeeEmail: employee.work_email || employee.private_email,
        managerName: manager?.name || '',
        managerEmail: manager?.work_email || manager?.private_email || '',
        category: expenseData.category,
        amount: parseFloat(expenseData.amount),  // Convert to number
        vendor: expenseData.vendor_name,
        expenseDate: expenseData.expense_date,
        description: expenseData.description,
        policyCheckPassed: policyCheck.passed,
        policyViolations: policyCheck.violations || [],
        submittedDate: new Date().toISOString(),
        approvalToken: expenseData.approval_token || null,
        backendUrl: process.env.BACKEND_URL || 'http://localhost:5000',
        // Workflow and fraud detection results (match Power Automate schema)
        workflow_status: expenseData.workflow_status || 'pending_manager',
        hr_escalated: expenseData.hr_escalated || false,
        fraud: expenseData.fraud || null
      };

      console.log('📤 Triggering Power Automate expense policy flow...');
      console.log('   Flow URL:', this.expensePolicyFlowUrl);
      console.log('   Payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(this.expensePolicyFlowUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000  // 60s — PA flows can take time to send emails and respond
      });

      console.log('✅ Power Automate expense policy flow triggered successfully');
      return response.data;

    } catch (error) {
      console.error('⚠️  Power Automate flow trigger failed:', error.message);
      if (error.response) {
        console.error('   Response status:', error.response.status);
        console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }

  /**
   * Trigger expense approval response flow
   * Handles manager/HR decision notifications
   */
  async triggerApprovalResponseFlow(decisionData) {
    try {
      if (!this.expenseApprovalResponseFlowUrl) {
        console.warn('⚠️  Expense approval response flow URL not configured');
        return null;
      }

      console.log(`🔄 Triggering Expense Approval Response Flow for expense ${decisionData.expenseId}`);
      console.log('   Decision:', decisionData.decision);
      console.log('   Approver Type:', decisionData.approverType);
      console.log('   Next Stage:', decisionData.nextStage);

      const response = await axios.post(this.expenseApprovalResponseFlowUrl, decisionData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      console.log(`✅ Approval response flow triggered successfully`);
      return response.data;

    } catch (error) {
      console.error(`❌ Approval response flow error:`, error.message);
      if (error.response) {
        console.error('   Response status:', error.response.status);
        console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }
}

module.exports = new PowerAutomateService();
