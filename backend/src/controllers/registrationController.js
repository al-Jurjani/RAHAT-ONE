const odooAdapter = require('../adapters/odooAdapter');
const { respondSuccess, respondError } = require('../utils/responseHandler');
const bcrypt = require('bcryptjs');

/**
 * HR initiates onboarding by adding personal email
 * Creates employee record with status "initiated"
 * Triggers n8n invitation flow
 */
async function initiateOnboarding(req, res) {
  try {
    const { personalEmail, name, email, phone, departmentId, jobId, manualReviewRequired } = req.body;

    const candidateEmail = personalEmail || email;

    if (!candidateEmail) {
      return respondError(res, 'Personal email is required', 400);
    }

    // Create employee record with initiated status
    const employeeData = {
      name: name || 'Pending Registration',
      private_email: candidateEmail,
      onboarding_status: 'initiated',
      onboarding_initiated_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      ai_verification_status: 'pending',
      hr_verification_status: 'pending',
      manual_review_required: manualReviewRequired || false
    };

    // Set HR-assigned department/position if provided
    if (departmentId) {
      employeeData.department_id = parseInt(departmentId);
      employeeData.hr_assigned_department_id = parseInt(departmentId);
    }
    if (jobId) {
      employeeData.job_id = parseInt(jobId);
      employeeData.hr_assigned_job_id = parseInt(jobId);
    }
    if (phone) {
      employeeData.mobile_phone = phone;
    }

    const employeeId = await odooAdapter.createEmployee(employeeData);

    // Trigger n8n invitation flow
    const powerAutomateService = require('../services/powerAutomateService');
    try {
      await powerAutomateService.triggerOnboardingFlow('initiate', {
        employeeId: employeeId,
        name: name || 'Candidate',
        email: candidateEmail,
        phone: phone || '',
        departmentId: departmentId || null,
        jobId: jobId || null,
        manualReviewRequired: manualReviewRequired || false
      });
    } catch (error) {
      console.error('n8n trigger error:', error.message);
    }

    respondSuccess(res, {
      employeeId,
      email: candidateEmail,
      status: 'initiated',
      message: 'Invitation email sent successfully'
    }, 201);

  } catch (error) {
    console.error('Initiate onboarding error:', error);
    respondError(res, error.message, 500);
  }
}

/**
 * Candidate completes registration form
 * Uploads CNIC and other documents
 * Saves bank details and emergency contact
 * Triggers n8n orchestration flow (OCR + auto-approve decision handled by n8n)
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
      password,
      // Bank details
      bankName,
      bankAccountNumber,
      bankIban,
      // Emergency contact
      emergencyContactName,
      emergencyContactRelationship,
      emergencyContactPhone,
      // Medical declaration (shop floor checkbox)
      medicalDeclaration,
      // Employee token from registration link
      employeeToken
    } = req.body;

    const passwordHash = await bcrypt.hash(password, 10);

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

    // Find employee by personal email (or by token if provided)
    let employeeIds;
    if (employeeToken) {
      // Token is the employee ID from the registration link
      const tokenId = parseInt(employeeToken);
      if (tokenId) {
        employeeIds = [tokenId];
      }
    }
    if (!employeeIds || employeeIds.length === 0) {
      employeeIds = await odooAdapter.searchEmployees([
        ['private_email', '=', personalEmail],
        ['onboarding_status', '=', 'initiated']
      ]);
    }

    if (employeeIds.length === 0) {
      return respondError(res, 'No pending registration found for this email', 404);
    }

    const employeeId = employeeIds[0];

    // Generate work email
    const workEmail = await generateWorkEmail(name);

    // Upload documents to Odoo
    await odooAdapter.uploadDocument(
      cnicFile.data,
      `CNIC_${name.replace(/\s/g, '_')}.${cnicFile.name.split('.').pop()}`,
      'hr.employee',
      employeeId,
      'CNIC Document'
    );

    if (degreeFile) {
      await odooAdapter.uploadDocument(
        degreeFile.data,
        `Degree_${name.replace(/\s/g, '_')}.${degreeFile.name.split('.').pop()}`,
        'hr.employee',
        employeeId,
        'Degree Certificate'
      );
    }

    if (medicalFile) {
      await odooAdapter.uploadDocument(
        medicalFile.data,
        `Medical_${name.replace(/\s/g, '_')}.${medicalFile.name.split('.').pop()}`,
        'hr.employee',
        employeeId,
        'Medical Certificate'
      );
    }

    // Update employee record with registration data
    const updateData = {
      name: name,
      work_email: workEmail,
      entered_cnic_number: cnicNumber,
      entered_father_name: fatherName,
      birthday: dateOfBirth,
      mobile_phone: phone,
      onboarding_status: 'documents_submitted',
      cnic_uploaded: true,
      degree_uploaded: !!degreeFile,
      medical_uploaded: !!medicalFile,
      registration_password_hash: passwordHash,
      // Bank details
      bank_name: bankName || false,
      bank_account_number: bankAccountNumber || false,
      bank_iban: bankIban || false,
      // Emergency contact
      emergency_contact_name: emergencyContactName || false,
      emergency_contact_relationship: emergencyContactRelationship || false,
      emergency_contact_phone: emergencyContactPhone || false,
    };

    await odooAdapter.updateEmployee(employeeId, updateData);

    // Trigger n8n orchestration flow (handles OCR, decision, provisioning)
    const powerAutomateService = require('../services/powerAutomateService');
    try {
      await powerAutomateService.triggerOnboardingFlow('registration_complete', {
        employeeId: employeeId,
        name: name,
        personalEmail: personalEmail,
        workEmail: workEmail,
        cnicNumber: cnicNumber,
        hasDegreDoc: !!degreeFile,
        hasMedicalDoc: !!medicalFile,
        medicalDeclaration: medicalDeclaration === 'true' || medicalDeclaration === true
      });
    } catch (error) {
      console.error('n8n trigger error:', error.message);
    }

    respondSuccess(res, {
      employeeId,
      workEmail,
      status: 'documents_submitted',
      message: 'Registration completed! Your documents are being verified. You will receive an email once verification is complete.'
    }, 201);

  } catch (error) {
    console.error('Registration error:', error);
    respondError(res, error.message, 500);
  }
}

/**
 * Generate work email from name
 */
async function generateWorkEmail(name) {
  const nameParts = name.trim().toLowerCase().split(' ');
  let firstName = (nameParts[0] || '').replace(/[^a-z]/g, '');
  let lastName = nameParts.length > 1 ? (nameParts[nameParts.length - 1] || '').replace(/[^a-z]/g, '') : '';

  let baseEmail = `${firstName}.${lastName}`;
  let workEmail = `${baseEmail}@outfitters.com`;
  let counter = 1;

  while (true) {
    const existing = await odooAdapter.execute('hr.employee', 'search_count', [
      [['work_email', '=', workEmail]]
    ]);

    if (existing === 0) break;

    workEmail = `${baseEmail}${counter}@outfitters.com`;
    counter++;

    if (counter > 100) {
      throw new Error('Unable to generate unique email');
    }
  }

  return workEmail;
}

module.exports = {
  initiateOnboarding,
  completeRegistration
};
