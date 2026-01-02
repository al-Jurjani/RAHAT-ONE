const documentIntelligenceService = require('./documentIntelligenceService');
const verificationService = require('./verificationService');
const odooAdapter = require('../adapters/odooAdapter');
const powerAutomateService = require('./powerAutomateService');
const fs = require('fs').promises;

class OnboardingService {
  /**
   * Initiate onboarding for a new employee
   */
  async initiateOnboarding(employeeData) {
    try {
      // Create employee record in Odoo with correct status value
      const employeeId = await odooAdapter.createEmployee({
        name: employeeData.name,
        private_email: employeeData.email,  // Personal email - used for lookup during registration
        mobile_phone: employeeData.phone,
        department_id: employeeData.departmentId || false,
        job_id: employeeData.jobId || false,
        hr_assigned_department_id: employeeData.departmentId || false,  // Track HR's assignment
        hr_assigned_job_id: employeeData.jobId || false,  // Track HR's assignment
        onboarding_status: 'initiated',  // ✅ This matches your Odoo field
        onboarding_initiated_date: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });

      console.log('✅ Employee created in Odoo. ID:', employeeId);

      const result = {
        employeeId,
        name: employeeData.name,
        email: employeeData.email,
        phone: employeeData.phone,
        status: 'initiated',
        progress: 0,
        message: 'Onboarding process initiated successfully'
      };

      // 🚀 TRIGGER POWER AUTOMATE FLOW
      await powerAutomateService.triggerOnboardingFlow(result);
      return result;

    } catch (error) {
      console.error('❌ Error initiating onboarding:', error);
      throw error;
    }
  }

  /**
   * Update onboarding status based on document uploads
   */
  async updateOnboardingStatus(employeeId, checklist) {
    try {
      const totalDocs = checklist.length;
      const completedDocs = checklist.filter(item => item.status === 'completed').length;

      // Determine appropriate Odoo status
      let odooStatus = 'initiated';
      if (completedDocs > 0 && completedDocs < totalDocs) {
        odooStatus = 'documents_submitted';
      } else if (completedDocs === totalDocs) {
        odooStatus = 'verification_pending';
      }

      // Update Odoo with the correct status
      // Note: progress_percentage is computed automatically by Odoo
      await odooAdapter.update('hr.employee', employeeId, {
        onboarding_status: odooStatus
      });

      console.log(`✅ Updated onboarding status: ${odooStatus}`);

      return { status: odooStatus };
    } catch (error) {
      console.error('❌ Error updating onboarding status:', error);
      throw error;
    }
  }

  /**
   * Upload onboarding document
   */
  async uploadDocument(employeeId, documentType, filePath, fileName) {
    try {
      // Verify employee exists
      const employee = await odooAdapter.getEmployee(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Read file
      const fileBuffer = await fs.readFile(filePath);

      // Upload to Odoo as attachment
      const attachmentId = await odooAdapter.uploadAttachment(
        `${documentType}_${fileName}`,
        fileBuffer,
        'hr.employee',
        employeeId
      );

      // Clean up temporary file
      await fs.unlink(filePath);

      console.log('✅ Document uploaded. Attachment ID:', attachmentId);

      // Get updated status
      const statusData = await this.getOnboardingStatus(employeeId);

      return {
        attachmentId,
        employeeId,
        documentType,
        fileName,
        status: 'uploaded',
        currentProgress: statusData.progress,
        overallStatus: statusData.status
      };
    } catch (error) {
      console.error('❌ Error uploading document:', error);
      throw error;
    }
  }

  /**
   * Get onboarding status
   */
  async getOnboardingStatus(employeeId) {
    try {
      // Get employee details with onboarding fields
      const employees = await odooAdapter.execute('hr.employee', 'read', [
        [employeeId],
        [
          'name',
          'work_email',
          'onboarding_status',
          'onboarding_progress_percentage',
          'documents_verified',
          'email_provisioned',
          'system_access_provisioned',
          'orientation_completed'
        ]
      ]);

      if (employees.length === 0) {
        throw new Error('Employee not found');
      }

      const employee = employees[0];

      // Get attached documents
      const attachments = await odooAdapter.execute('ir.attachment', 'search_read', [
        [
          ['res_model', '=', 'hr.employee'],
          ['res_id', '=', employeeId]
        ],
        ['name', 'create_date', 'mimetype']
      ]);

      // Build checklist
      const requiredDocuments = ['CNIC', 'Degree', 'Medical'];
      const checklist = requiredDocuments.map(docType => {
        const uploaded = attachments.some(att =>
          att.name.toLowerCase().includes(docType.toLowerCase())
        );
        return {
          documentType: docType,
          status: uploaded ? 'completed' : 'pending',
          uploaded
        };
      });

      // Update status based on checklist
      await this.updateOnboardingStatus(employeeId, checklist);

      // Re-fetch to get updated computed progress
      const updatedEmployee = await odooAdapter.execute('hr.employee', 'read', [
        [employeeId],
        ['onboarding_status', 'onboarding_progress_percentage']
      ]);

      return {
        employeeId,
        employee: {
          name: employee.name,
          email: employee.work_email
        },
        checklist,
        progress: updatedEmployee[0].onboarding_progress_percentage || 0,
        status: updatedEmployee[0].onboarding_status,
        verificationFlags: {
          documents_verified: employee.documents_verified,
          email_provisioned: employee.email_provisioned,
          system_access_provisioned: employee.system_access_provisioned,
          orientation_completed: employee.orientation_completed
        }
      };
    } catch (error) {
      console.error('❌ Error getting onboarding status:', error);
      throw error;
    }
  }

  /**
   * Verify a document (HR action)
   */
  async verifyDocument(attachmentId, verificationStatus) {
    try {
      console.log(`✅ Document ${attachmentId} marked as ${verificationStatus}`);

      return {
        attachmentId,
        verificationStatus,
        verifiedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error verifying document:', error);
      throw error;
    }
  }

  /**
   * Mark documents as verified (triggers status update)
   */
  async markDocumentsVerified(employeeId) {
    try {
      await odooAdapter.update('hr.employee', employeeId, {
        documents_verified: true,
        onboarding_status: 'verified'
      });

      console.log(`✅ Documents verified for employee ${employeeId}`);

      return {
        employeeId,
        status: 'verified'
      };
    } catch (error) {
      console.error('❌ Error marking documents verified:', error);
      throw error;
    }
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding(employeeId) {
    try {
      await odooAdapter.update('hr.employee', employeeId, {
        onboarding_status: 'activated',
        onboarding_completed_date: new Date().toISOString(),
        documents_verified: true,
        email_provisioned: true,
        system_access_provisioned: true,
        orientation_completed: true
      });

      console.log(`✅ Onboarding completed for employee ${employeeId}`);

      return {
        employeeId,
        status: 'activated',
        progress: 100,
        completedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error completing onboarding:', error);
      throw error;
    }
  }

  /**
   * Run AI verification on uploaded CNIC
   * Called after candidate submits registration
   */
  /**
 * Run AI verification on employee documents
 */
async runAIVerification(employeeId, cnicFilePath, enteredData, extractedData) {
  try {
    console.log('🔍 Running verification algorithm...');

    // Run verification algorithm
    const verificationResult = verificationService.verifyCNICData(
      extractedData,
      enteredData
    );

    console.log('📊 Verification results:', {
      passed: verificationResult.passed,
      score: verificationResult.overallScore
    });

    // Convert extracted DOB to Odoo format (YYYY-MM-DD)
    const extractedDobFormatted = this._convertToOdooDateFormat(extractedData.dob);

    // Update employee record in Odoo
    await odooAdapter.updateEmployee(employeeId, {
      // Extracted data
      extracted_name: extractedData.name || '',
      extracted_cnic_number: extractedData.cnicNumber || '',
      extracted_father_name: extractedData.fatherName || '',
      extracted_dob: extractedDobFormatted, // Use converted date
      ocr_confidence: extractedData.confidence || 0,

      // AI verification results
      ai_verification_status: verificationResult.passed ? 'passed' : 'failed',
      ai_verification_score: verificationResult.overallScore,
      ai_verification_details: JSON.stringify(verificationResult.details),
      ai_verification_date: new Date().toISOString().slice(0, 19).replace('T', ' '),

      // Update onboarding status
      onboarding_status: 'verification_pending'
    });

    console.log('✅ AI verification results saved to Odoo');

    return verificationResult;

  } catch (error) {
    console.error('❌ AI verification failed:', error);
    throw error;
  }
}

/**
 * Convert date from dd.mm.yyyy to YYYY-MM-DD format for Odoo
 */
_convertToOdooDateFormat(dateStr) {
  if (!dateStr) return null;

  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Convert dd.mm.yyyy to YYYY-MM-DD
  const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  // Try dd-mm-yyyy or dd/mm/yyyy
  const match2 = dateStr.match(/(\d{2})[\-\/](\d{2})[\-\/](\d{4})/);
  if (match2) {
    const [, day, month, year] = match2;
    return `${year}-${month}-${day}`;
  }

  // If can't convert, return null (Odoo will handle)
  console.warn('⚠️ Could not convert date to Odoo format:', dateStr);
  return null;
}
}

module.exports = new OnboardingService();
