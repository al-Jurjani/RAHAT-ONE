const onboardingService = require('../services/onboardingService');
const powerAutomateService = require('../services/powerAutomateService');
const { respondSuccess, respondError } = require('../utils/responseHandler');

class OnboardingController {
  /**
   * POST /api/onboarding/initiate
   * Thin trigger — validates input, fires n8n Flow C which handles
   * Odoo record creation, employee type determination, and invitation email.
   */
  async initiateOnboarding(req, res) {
    try {
      const { email, departmentId, jobId, manualReviewRequired } = req.body;

      if (!email) {
        return respondError(res, 'Email is required', 400);
      }
      if (!departmentId || !jobId) {
        return respondError(res, 'Department and position are required', 400);
      }

      // Fire n8n webhook — all work happens in the flow
      await powerAutomateService.triggerOnboardingFlow('initiate', {
        email: email.trim(),
        departmentId: parseInt(departmentId),
        jobId: parseInt(jobId),
        manualReviewRequired: manualReviewRequired || false,
        hrActorName: req.user?.name || 'HR',
        hrActorId: req.user?.id || null
      });

      return respondSuccess(res, {
        email: email.trim(),
        status: 'initiated'
      }, 'Onboarding initiated successfully', 201);
    } catch (error) {
      console.error('Controller Error:', error);
      return respondError(res, 'Failed to initiate onboarding', 500, error);
    }
  }

  /**
   * POST /api/onboarding/upload-document
   * Upload onboarding document
   */
  async uploadDocument(req, res) {
    try {
      const { employeeId, documentType } = req.body;
      const file = req.file;

      if (!employeeId || !documentType || !file) {
        return respondError(res, 'Employee ID, document type, and file are required', 400);
      }

      const result = await onboardingService.uploadDocument(
        parseInt(employeeId),
        documentType,
        file.path,
        file.originalname
      );

      return respondSuccess(res, result, 'Document uploaded successfully', 201);
    } catch (error) {
      console.error('Controller Error:', error);
      return respondError(res, 'Failed to upload document', 500, error);
    }
  }

  /**
   * GET /api/onboarding/status/:employeeId
   * Get onboarding status and checklist
   */
  async getStatus(req, res) {
    try {
      const { employeeId } = req.params;

      if (!employeeId) {
        return respondError(res, 'Employee ID is required', 400);
      }

      const result = await onboardingService.getOnboardingStatus(parseInt(employeeId));

      return respondSuccess(res, result, 'Onboarding status retrieved successfully');
    } catch (error) {
      console.error('Controller Error:', error);
      return respondError(res, 'Failed to get onboarding status', 500, error);
    }
  }

  /**
   * PUT /api/onboarding/verify-document
   * Verify uploaded document (HR action)
   */
  async verifyDocument(req, res) {
    try {
      const { attachmentId, verificationStatus } = req.body;

      if (!attachmentId || !verificationStatus) {
        return respondError(res, 'Attachment ID and verification status are required', 400);
      }

      const result = await onboardingService.verifyDocument(
        parseInt(attachmentId),
        verificationStatus
      );

      return respondSuccess(res, result, 'Document verified successfully');
    } catch (error) {
      console.error('Controller Error:', error);
      return respondError(res, 'Failed to verify document', 500, error);
    }
  }
}

module.exports = new OnboardingController();
