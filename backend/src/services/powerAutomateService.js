const axios = require('axios');

class PowerAutomateService {
  constructor() {
    this.webhooks = {
      onboardingInitiated: process.env.PA_ONBOARDING_WEBHOOK || null
    };
  }

  /**
   * Trigger onboarding flow when employee created
   */
  async triggerOnboardingFlow(employeeData) {
    if (!this.webhooks.onboardingInitiated) {
      console.log('⚠️  Power Automate webhook not configured');
      return null;
    }

    try {
      console.log('🚀 Triggering Power Automate flow...');

      const response = await axios.post(this.webhooks.onboardingInitiated, {
        employeeId: employeeData.employeeId,
        name: employeeData.name,
        email: employeeData.email,
        phone: employeeData.phone || '',
        status: employeeData.status,
        progress: employeeData.progress || 0
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      console.log('✅ Power Automate flow triggered successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to trigger Power Automate:', error.message);
      // Don't throw - we don't want to fail the API if Power Automate fails
      return null;
    }
  }
}

module.exports = new PowerAutomateService();
