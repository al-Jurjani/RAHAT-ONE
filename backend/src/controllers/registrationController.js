const onboardingService = require('../services/onboardingService');
const odooAdapter = require('../adapters/odooAdapter');
const { respondSuccess, respondError } = require('../utils/responseHandler');
const path = require('path');

/**
 * HR initiates onboarding by adding personal email
 * Creates employee record with status "initiated"
 * Triggers invitation email via Power Automate
 */
async function initiateOnboarding(req, res) {
  try {
    const { personalEmail, name } = req.body;

    if (!personalEmail) {
      return respondError(res, 'Personal email is required', 400);
    }

    // Create employee record with initiated status
    const employeeData = {
      name: name || 'Pending Registration',
      private_email: personalEmail,
      onboarding_status: 'initiated',
      onboarding_initiated_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      ai_verification_status: 'pending',
      hr_verification_status: 'pending'
    };

    const employeeId = await odooAdapter.createEmployee(employeeData);

    // Trigger Power Automate flow - send invitation email
    const powerAutomateService = require('../services/powerAutomateService');
    try {
      await powerAutomateService.triggerOnboardingFlow({
        employeeId: employeeId,
        name: name || 'Candidate',
        email: personalEmail,
        status: 'initiated'
      });
    } catch (error) {
      console.error('❌ Power Automate trigger error:', error);
    }

    respondSuccess(res, {
      employeeId,
      status: 'initiated',
      message: 'Invitation email sent successfully'
    }, 201);

  } catch (error) {
    console.error('❌ Initiate onboarding error:', error);
    respondError(res, error.message, 500);
  }
}

/**
 * Candidate completes registration form
 * Uploads CNIC and other documents
 * Sets their own password
 * Triggers AI verification automatically
 */
async function completeRegistration(req, res) {
  try {
    const {
      personalEmail,
      name,
      cnicNumber,
      fatherName,
      dateOfBirth,
      phone,
      departmentId,
      department_id,
      jobPositionId,
      job_position_id,
      password
    } = req.body;

    // Use whichever one was sent and convert to integer
    const deptId = parseInt(departmentId || department_id || 0);
    const jobId = parseInt(jobPositionId || job_position_id || 0);

    console.log('📋 Registration data received:');
    console.log('  departmentId:', deptId, typeof deptId);
    console.log('  jobPositionId:', jobId, typeof jobId);

    // Validate required fields
    if (!personalEmail || !name || !cnicNumber || !password) {
      return respondError(res, 'Missing required fields', 400);
    }

    // Check for CNIC file
    const cnicFile = req.files?.cnic;
    if (!cnicFile) {
      return respondError(res, 'CNIC document is required', 400);
    }

    const degreeFile = req.files?.degree;
    const medicalFile = req.files?.medical;

    // Find employee by personal email
    const employeeIds = await odooAdapter.searchEmployees([
      ['private_email', '=', personalEmail],
      ['onboarding_status', '=', 'initiated']
    ]);

    if (employeeIds.length === 0) {
      return respondError(res, 'No pending registration found for this email', 404);
    }

    const employeeId = employeeIds[0];

    // Generate work email
    const workEmail = generateWorkEmail(name);

    // Upload documents to Odoo
    const cnicAttachmentId = await odooAdapter.uploadDocument(
      cnicFile.data,
      `CNIC_${name.replace(/\s/g, '_')}.${cnicFile.name.split('.').pop()}`,
      'hr.employee',
      employeeId,
      'CNIC Document'
    );

    let degreeAttachmentId = null;
    if (degreeFile) {
      degreeAttachmentId = await odooAdapter.uploadDocument(
        degreeFile.data,
        `Degree_${name.replace(/\s/g, '_')}.${degreeFile.name.split('.').pop()}`,
        'hr.employee',
        employeeId,
        'Degree Certificate'
      );
    }

    let medicalAttachmentId = null;
    if (medicalFile) {
      medicalAttachmentId = await odooAdapter.uploadDocument(
        medicalFile.data,
        `Medical_${name.replace(/\s/g, '_')}.${medicalFile.name.split('.').pop()}`,
        'hr.employee',
        employeeId,
        'Medical Certificate'
      );
    }

    // Update employee record with registration data
    await odooAdapter.updateEmployee(employeeId, {
      name: name,
      work_email: workEmail,
      entered_cnic_number: cnicNumber,
      entered_father_name: fatherName,
      birthday: dateOfBirth,
      mobile_phone: phone,
      department_id: deptId > 0 ? deptId : false,
      job_id: jobId > 0 ? jobId : false,
      onboarding_status: 'documents_submitted',
      cnic_uploaded: true,
      degree_uploaded: degreeFile ? true : false,
      medical_uploaded: medicalFile ? true : false
    });

    // Create user account (TODO: implement password hashing)
    console.log('👤 User account should be created:', workEmail);

    // Save CNIC file temporarily for AI verification
    const fs = require('fs');
    const path = require('path');
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const cnicTempPath = path.join(tempDir, `cnic_${employeeId}.${cnicFile.name.split('.').pop()}`);
    fs.writeFileSync(cnicTempPath, cnicFile.data);

    // Trigger AI verification asynchronously
    const enteredData = {
      name,
      cnicNumber,
      fatherName,
      dateOfBirth
    };

    runAIVerificationAsync(employeeId, cnicTempPath, enteredData);

    respondSuccess(res, {
      employeeId,
      workEmail,
      status: 'documents_submitted',
      message: 'Registration completed! Your documents are being verified. You will receive an email once verification is complete.'
    }, 201);

  } catch (error) {
    console.error('❌ Registration error:', error);
    respondError(res, error.message, 500);
  }
}

/**
 * Run AI verification asynchronously (non-blocking)
 */
async function runAIVerificationAsync(employeeId, cnicFilePath, enteredData) {
  try {
    console.log(`🤖 Running AI verification for employee ${employeeId}`);

    // Extract CNIC data using Azure Document Intelligence
    const documentIntelligenceService = require('../services/documentIntelligenceService');
    const extractedData = await documentIntelligenceService.extractCNICData(cnicFilePath);

    console.log('📄 Extracted CNIC data:', extractedData);

    // Run verification
    const onboardingService = require('../services/onboardingService');
    await onboardingService.runAIVerification(
      employeeId,
      cnicFilePath,
      enteredData,
      extractedData
    );

    console.log(`✅ AI verification complete for employee ${employeeId}`);

    // Clean up temp file
    const fs = require('fs');
    if (fs.existsSync(cnicFilePath)) {
      fs.unlinkSync(cnicFilePath);
      console.log('🗑️ Cleaned up temp CNIC file');
    }

  } catch (error) {
    console.error('❌ AI verification error:', error);
  }
}

/**
 * Generate work email from name
 */
function generateWorkEmail(name) {
  const nameParts = name.toLowerCase().trim().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];

  return `${firstName}.${lastName}@outfitters.com`;
}

/**
 * Create Odoo user account for employee portal login
 */
async function createUserAccount(workEmail, password, employeeId) {
  // TODO: Implement Odoo user creation with password hashing
  // This will be part of Odoo adapter
  console.log(`👤 User account should be created: ${workEmail}`);
  return null; // Placeholder
}

/**
 * Get registration status by personal email
 * Allows candidate to check their status
 */
async function getRegistrationStatus(req, res) {
  try {
    const { personalEmail } = req.query;

    if (!personalEmail) {
      return respondError(res, 'Personal email is required', 400);
    }

    const employees = await odooAdapter.searchEmployees([
      ['private_email', '=', personalEmail]
    ]);

    if (employees.length === 0) {
      return respondError(res, 'No registration found', 404);
    }

    const employeeId = employees[0];
    const employeeData = await odooAdapter.getEmployee(employeeId);

    respondSuccess(res, {
      status: employeeData.onboarding_status,
      progress: employeeData.onboarding_progress_percentage,
      aiVerification: {
        status: employeeData.ai_verification_status,
        score: employeeData.ai_verification_score
      },
      hrVerification: {
        status: employeeData.hr_verification_status
      },
      workEmail: employeeData.work_email,
      rejectionReason: employeeData.rejection_reason,
      rejectionDetails: employeeData.rejection_details
    });

  } catch (error) {
    console.error('❌ Get status error:', error);
    respondError(res, error.message, 500);
  }
}

module.exports = {
  initiateOnboarding,
  completeRegistration,
  getRegistrationStatus
};
