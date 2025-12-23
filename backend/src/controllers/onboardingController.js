const onboardingService = require('../services/onboardingService');
const { successResponse, errorResponse } = require('../utils/responseHandler');

class OnboardingController {
  /**
   * POST /api/onboarding/initiate
   * Initiate onboarding for new employee
   */
  async initiateOnboarding(req, res) {
    try {
      const { name, email, phone, departmentId, jobId } = req.body;

      // Basic validation
      if (!name || !email) {
        return errorResponse(res, 'Name and email are required', 400);
      }

      const result = await onboardingService.initiateOnboarding({
        name,
        email,
        phone,
        departmentId,
        jobId
      });

      return successResponse(res, result, 'Onboarding initiated successfully', 201);
    } catch (error) {
      console.error('Controller Error:', error);
      return errorResponse(res, 'Failed to initiate onboarding', 500, error);
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
        return errorResponse(res, 'Employee ID, document type, and file are required', 400);
      }

      const result = await onboardingService.uploadDocument(
        parseInt(employeeId),
        documentType,
        file.path,
        file.originalname
      );

      return successResponse(res, result, 'Document uploaded successfully', 201);
    } catch (error) {
      console.error('Controller Error:', error);
      return errorResponse(res, 'Failed to upload document', 500, error);
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
        return errorResponse(res, 'Employee ID is required', 400);
      }

      const result = await onboardingService.getOnboardingStatus(parseInt(employeeId));

      return successResponse(res, result, 'Onboarding status retrieved successfully');
    } catch (error) {
      console.error('Controller Error:', error);
      return errorResponse(res, 'Failed to get onboarding status', 500, error);
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
        return errorResponse(res, 'Attachment ID and verification status are required', 400);
      }

      const result = await onboardingService.verifyDocument(
        parseInt(attachmentId),
        verificationStatus
      );

      return successResponse(res, result, 'Document verified successfully');
    } catch (error) {
      console.error('Controller Error:', error);
      return errorResponse(res, 'Failed to verify document', 500, error);
    }
  }
}

module.exports = new OnboardingController();
