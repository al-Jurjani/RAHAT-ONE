const axios = require('axios');

class PowerAutomateService {
  constructor() {
    this.flowUrl = process.env.PA_ONBOARDING_WEBHOOK;
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
}

module.exports = new PowerAutomateService();
