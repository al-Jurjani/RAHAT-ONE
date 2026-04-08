// n8n now handles OCR + verification — these services are no longer called from backend
// const documentIntelligenceService = require('./documentIntelligenceService');
// const verificationService = require('./verificationService');
const odooAdapter = require('../adapters/odooAdapter');
const powerAutomateService = require('./powerAutomateService');
const fs = require('fs').promises;

class OnboardingService {
  /**
 * Initiate onboarding for a new employee
 */
async initiateOnboarding(employeeData) {
  try {
    // Create employee record in Odoo
    const employeeId = await odooAdapter.createEmployee({
      name: employeeData.name,
      private_email: employeeData.email,
      mobile_phone: employeeData.phone,
      department_id: employeeData.departmentId || false,
      job_id: employeeData.jobId || false,

      // 🆕 ALSO SET HR ASSIGNED FIELDS (for tracking original assignment)
      hr_assigned_department_id: employeeData.departmentId || false,
      hr_assigned_job_id: employeeData.jobId || false,

      onboarding_status: 'initiated',
      onboarding_initiated_date: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });

    console.log('✅ Employee created in Odoo. ID:', employeeId);

    // Fetch department name
    let departmentName = 'N/A';
    if (employeeData.departmentId) {
      const dept = await odooAdapter.execute('hr.department', 'read', [
        [employeeData.departmentId],
        ['name']
      ]);
      departmentName = dept?.[0]?.name || 'N/A';
    }

    // Fetch position name
    let positionName = 'N/A';
    if (employeeData.jobId) {
      const job = await odooAdapter.execute('hr.job', 'read', [
        [employeeData.jobId],
        ['name']
      ]);
      positionName = job?.[0]?.name || 'N/A';
    }

    console.log('📋 Department:', departmentName);
    console.log('📋 Position:', positionName);

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
    powerAutomateService.sendRegistrationEmail({
      id: employeeId,
      name: employeeData.name,
      personalEmail: employeeData.email,
      phone: employeeData.phone,
      department: departmentName,
      position: positionName
    }).catch(err => {
      console.error('⚠️ Email notification failed, but onboarding succeeded:', err.message);
    });

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

  // =============================================================
  // COMMENTED OUT — n8n now handles onboarding completion and
  // AI/OCR verification. Kept as reference/fallback.
  // =============================================================

  /*
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

      console.log('Onboarding completed for employee', employeeId);

      return {
        employeeId,
        status: 'activated',
        progress: 100,
        completedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  }

  async runAIVerification(employeeId, cnicFilePath, enteredData, extractedData) {
    try {
      const verificationResult = verificationService.verifyCNICData(
        extractedData,
        enteredData
      );

      const extractedDobFormatted = this._convertToOdooDateFormat(extractedData.dob);

      await odooAdapter.updateEmployee(employeeId, {
        extracted_name: extractedData.name || '',
        extracted_cnic_number: extractedData.cnicNumber || '',
        extracted_father_name: extractedData.fatherName || '',
        extracted_dob: extractedDobFormatted,
        ocr_confidence: extractedData.confidence || 0,
        ai_verification_status: verificationResult.passed ? 'passed' : 'failed',
        ai_verification_score: verificationResult.overallScore,
        ai_verification_details: JSON.stringify(verificationResult.details),
        ai_verification_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        onboarding_status: 'verification_pending'
      });

      return verificationResult;
    } catch (error) {
      console.error('AI verification failed:', error);
      throw error;
    }
  }

  _convertToOdooDateFormat(dateStr) {
    if (!dateStr) return null;
    let day, month, year;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parts = dateStr.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
      if (this._isValidDate(year, month, day)) return dateStr;
      return null;
    }
    const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) {
      [, day, month, year] = match.map(v => parseInt(v, 10));
      if (this._isValidDate(year, month, day)) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      return null;
    }
    const match2 = dateStr.match(/(\d{2})[\-\/](\d{2})[\-\/](\d{4})/);
    if (match2) {
      [, day, month, year] = match2.map(v => parseInt(v, 10));
      if (this._isValidDate(year, month, day)) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      return null;
    }
    return null;
  }

  _isValidDate(year, month, day) {
    if (year < 1900 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }
  */


/**
 * Allocate initial leave balances for newly approved employee
 */
async allocateInitialLeaves(employeeId) {
  try {
    console.log('🎯 Allocating initial leaves for employee:', employeeId);

    // Get all leave types from Odoo
    const leaveTypes = await odooAdapter.getLeaveTypes();
    console.log('📋 Available leave types:', leaveTypes);

    // Default allocation: 20 days for each type
    const DEFAULT_DAYS = 20;
    const currentYear = new Date().getFullYear();
    const startDate = `${currentYear}-01-01`;
    const endDate = `${currentYear}-12-31`;

    const allocations = [];

    // Allocate for each leave type
    for (const leaveType of leaveTypes) {
      try {
        console.log(`   Allocating ${DEFAULT_DAYS} days for ${leaveType.name}...`);

        // Create allocation record
        const allocationId = await odooAdapter.create('hr.leave.allocation', {
          name: `Initial Allocation - ${leaveType.name}`,
          holiday_status_id: leaveType.id,
          employee_id: employeeId,
          number_of_days: DEFAULT_DAYS,
          date_from: startDate,
          date_to: endDate,
          state: 'confirm',
          notes: 'Automatic allocation on employee onboarding'
        });

        console.log(`   ✅ Allocation created with ID: ${allocationId}`);

        // Validate the allocation (makes it active)
        await odooAdapter.execute('hr.leave.allocation', 'action_validate', [[allocationId]]);
        console.log(`   ✅ Allocation validated`);

        allocations.push({
          leaveType: leaveType.name,
          leaveTypeId: leaveType.id,
          days: DEFAULT_DAYS,
          allocationId: allocationId
        });

      } catch (typeError) {
        console.error(`   ❌ Failed to allocate ${leaveType.name}:`, typeError.message);
        // Continue with other types even if one fails
      }
    }

    console.log('✅ Leave allocation completed:', allocations);

    return {
      success: true,
      employeeId: employeeId,
      allocations: allocations,
      message: `Successfully allocated ${allocations.length} leave types`
    };

  } catch (error) {
    console.error('❌ Leave allocation failed:', error);
    throw error;
  }
}
}

module.exports = new OnboardingService();
