const axios = require('axios');

class PowerAutomateService {
  constructor() {
    this.flowUrl = process.env.PA_ONBOARDING_WEBHOOK;
    this.leaveFlowUrl = process.env.POWER_AUTOMATE_LEAVE_FLOW_URL;
    this.managerDecisionFlowUrl = process.env.PA_MANAGER_DECISION_WEBHOOK;
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
        timeout: 10000
      });

      console.log(`✅ Leave flow triggered successfully`);
      return response.data;

    } catch (error) {
      console.error(`❌ Leave flow error:`, error.message);
      return null;
    }
  }

  async triggerManagerDecisionFlow(decisionData) {
  try {
    console.log(`🔄 Triggering Manager Decision Flow`);

    const response = await axios.post(this.managerDecisionFlowUrl, decisionData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log(`✅ Manager decision flow triggered successfully`);
    return response.data;

  } catch (error) {
    console.error(`❌ Manager decision flow error:`, error.message);
    return null;
  }
}
}

module.exports = new PowerAutomateService();
