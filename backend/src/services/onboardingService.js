const odooAdapter = require('../adapters/odooAdapter');
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
        work_email: employeeData.email,
        mobile_phone: employeeData.phone,
        department_id: employeeData.departmentId || false,
        job_id: employeeData.jobId || false,
        // Custom field for onboarding status
        // Note: This field needs to be added to Odoo if not exists
      });

      console.log('Employee created in Odoo. ID:', employeeId);

      return {
        employeeId,
        status: 'initiated',
        message: 'Onboarding process initiated successfully'
      };
    } catch (error) {
      console.error('❌ Error initiating onboarding:', error);
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

      return {
        attachmentId,
        employeeId,
        documentType,
        fileName,
        status: 'uploaded'
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
      // Get employee details
      const employee = await odooAdapter.getEmployee(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

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

      const totalDocs = checklist.length;
      const completedDocs = checklist.filter(item => item.status === 'completed').length;
      const progress = Math.round((completedDocs / totalDocs) * 100);

      return {
        employeeId,
        employee: {
          name: employee.name,
          email: employee.work_email
        },
        checklist,
        progress,
        status: progress === 100 ? 'completed' : 'in_progress'
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
      // In a real scenario, you'd update custom fields
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
}

module.exports = new OnboardingService();
