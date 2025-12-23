const odooAdapter = require('../adapters/odooAdapter');
const fs = require('fs').promises;

class OnboardingService {
  /**
   * Initiate onboarding for a new employee
   */
  async initiateOnboarding(employeeData) {
    try {
      // Create employee record in Odoo with custom onboarding fields
      const employeeId = await odooAdapter.createEmployee({
        name: employeeData.name,
        work_email: employeeData.email,
        mobile_phone: employeeData.phone,
        department_id: employeeData.departmentId || false,
        job_id: employeeData.jobId || false,
        // Custom fields you created
        onboarding_status: 'initiated',
        onboarding_progress_percentage: 0
      });

      console.log('✅ Employee created in Odoo. ID:', employeeId);

      return {
        employeeId,
        status: 'initiated',
        progress: 0,
        message: 'Onboarding process initiated successfully'
      };
    } catch (error) {
      console.error('❌ Error initiating onboarding:', error);
      throw error;
    }
  }

  /**
   * Calculate and update onboarding progress
   */
  async updateOnboardingProgress(employeeId, checklist) {
    try {
      const totalDocs = checklist.length;
      const completedDocs = checklist.filter(item => item.status === 'completed').length;
      const progress = Math.round((completedDocs / totalDocs) * 100);

      // Determine status based on progress
      let status = 'initiated';
      if (progress > 0 && progress < 100) {
        status = 'in_progress';
      } else if (progress === 100) {
        status = 'completed';
      }

      // Update Odoo employee record
      await odooAdapter.update('hr.employee', employeeId, {
        onboarding_status: status,
        onboarding_progress_percentage: progress
      });

      console.log(`✅ Updated onboarding progress: ${progress}% (${status})`);

      return { status, progress };
    } catch (error) {
      console.error('❌ Error updating onboarding progress:', error);
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

      // Get updated checklist and recalculate progress
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
      // Get employee details with custom fields
      const employees = await odooAdapter.search(
        'hr.employee',
        [['id', '=', employeeId]],
        ['name', 'work_email', 'onboarding_status', 'onboarding_progress_percentage']
      );

      if (employees.length === 0) {
        throw new Error('Employee not found');
      }

      const employee = employees[0];

      // Get attached documents
      const attachments = await odooAdapter.search(
        'ir.attachment',
        [
          ['res_model', '=', 'hr.employee'],
          ['res_id', '=', employeeId]
        ],
        ['name', 'create_date', 'mimetype']
      );

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

      // Update progress in Odoo
      const { status, progress } = await this.updateOnboardingProgress(employeeId, checklist);

      return {
        employeeId,
        employee: {
          name: employee.name,
          email: employee.work_email
        },
        checklist,
        progress,
        status,
        // Show the values stored in Odoo
        odooValues: {
          onboarding_status: employee.onboarding_status,
          onboarding_progress_percentage: employee.onboarding_progress_percentage
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
      // In a real scenario, you'd update custom verification fields on attachments
      // For now, we'll just return success
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
   * Complete onboarding (mark as completed manually if needed)
   */
  async completeOnboarding(employeeId) {
    try {
      await odooAdapter.update('hr.employee', employeeId, {
        onboarding_status: 'completed',
        onboarding_progress_percentage: 100
      });

      console.log(`✅ Onboarding completed for employee ${employeeId}`);

      return {
        employeeId,
        status: 'completed',
        progress: 100,
        completedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error completing onboarding:', error);
      throw error;
    }
  }
}

module.exports = new OnboardingService();
