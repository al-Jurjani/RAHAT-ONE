const odooAdapter = require('../adapters/odooAdapter');
const { respondSuccess, respondError } = require('../utils/responseHandler');

/**
 * Get all pending registrations for HR review
 */
async function getPendingRegistrations(req, res) {
  try {
    // Search for employees with documents submitted or verification pending
    const employeeIds = await odooAdapter.searchEmployees([
      ['onboarding_status', 'in', ['documents_submitted', 'verification_pending']]
    ]);

    const employees = [];
    for (const id of employeeIds) {
      const emp = await odooAdapter.getEmployee(id);
      employees.push({
        id: emp.id,
        name: emp.name,
        personalEmail: emp.private_email,
        workEmail: emp.work_email,
        department: emp.department_id?.[1] || 'N/A',
        position: emp.job_id?.[1] || 'N/A',
        onboardingStatus: emp.onboarding_status,
        aiVerification: {
          status: emp.ai_verification_status,
          score: emp.ai_verification_score,
          date: emp.ai_verification_date
        },
        hrVerification: {
          status: emp.hr_verification_status
        },
        documentsUploaded: {
          cnic: emp.cnic_uploaded,
          degree: emp.degree_uploaded,
          medical: emp.medical_uploaded
        },
        submittedDate: emp.create_date
      });
    }

    respondSuccess(res, employees);

  } catch (error) {
    console.error('❌ Get pending registrations error:', error);
    respondError(res, error.message, 500);
  }
}

/**
 * Get detailed verification data for a specific employee
 */
async function getVerificationDetails(req, res) {
  try {
    const { employeeId } = req.params;

    const employee = await odooAdapter.getEmployee(employeeId);

    // Parse AI verification details
    let aiDetails = {};
    if (employee.ai_verification_details) {
      try {
        aiDetails = JSON.parse(employee.ai_verification_details);
      } catch (e) {
        console.warn('Failed to parse AI verification details');
      }
    }

    // Get uploaded documents
    const documents = await odooAdapter.getEmployeeDocuments(employeeId);

    respondSuccess(res, {
      employee: {
        id: employee.id,
        name: employee.name,
        personalEmail: employee.private_email,
        workEmail: employee.work_email,
        phone: employee.mobile_phone,
        department: employee.department_id?.[1],
        position: employee.job_id?.[1]
      },
      enteredData: {
        name: employee.name,
        cnicNumber: employee.entered_cnic_number,
        fatherName: employee.entered_father_name,
        dateOfBirth: employee.birthday
      },
      extractedData: {
        name: employee.extracted_name,
        cnicNumber: employee.extracted_cnic_number,
        fatherName: employee.extracted_father_name,
        dateOfBirth: employee.extracted_dob,
        ocrConfidence: employee.ocr_confidence
      },
      aiVerification: {
        status: employee.ai_verification_status,
        score: employee.ai_verification_score,
        date: employee.ai_verification_date,
        details: aiDetails
      },
      hrVerification: {
        status: employee.hr_verification_status,
        notes: employee.hr_verification_notes,
        verifiedBy: employee.hr_verified_by,
        verifiedDate: employee.hr_verified_date
      },
      documents: documents,
      onboardingStatus: employee.onboarding_status
    });

  } catch (error) {
    console.error('❌ Get verification details error:', error);
    respondError(res, error.message, 500);
  }
}

/**
 * HR approves candidate
 */
async function approveCandidate(req, res) {
  try {
    const { employeeId } = req.params;
    const { notes } = req.body;
    const hrUserId = req.user?.id || 2; // Get from JWT token, default to admin

    // Update HR verification status
    await odooAdapter.updateEmployee(employeeId, {
      hr_verification_status: 'approved',
      hr_verification_notes: notes || 'Approved by HR',
      hr_verified_by: hrUserId,
      hr_verified_date: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });

    // Check if both AI and HR verifications passed
    const employee = await odooAdapter.getEmployee(employeeId);

    if (employee.ai_verification_status === 'passed' &&
        employee.hr_verification_status === 'approved') {

      // Update status to verified
      await odooAdapter.updateEmployee(employeeId, {
        onboarding_status: 'verified'
      });

      // TODO: Trigger Power Automate - Email provisioning flow
      console.log(`✉️ Email provisioning should be triggered for employee ${employeeId}`);
    }

    respondSuccess(res, {
      message: 'Candidate approved successfully',
      status: employee.onboarding_status
    });

  } catch (error) {
    console.error('❌ Approve candidate error:', error);
    respondError(res, error.message, 500);
  }
}

/**
 * HR rejects candidate
 */
async function rejectCandidate(req, res) {
  try {
    const { employeeId } = req.params;
    const { reason, details } = req.body;
    const hrUserId = req.user?.id || 2;

    if (!reason) {
      return respondError(res, 'Rejection reason is required', 400);
    }

    // Update HR verification status
    await odooAdapter.updateEmployee(employeeId, {
      hr_verification_status: 'rejected',
      hr_verification_notes: details || 'Rejected by HR',
      hr_verified_by: hrUserId,
      hr_verified_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      onboarding_status: 'rejected',
      rejection_reason: reason,
      rejection_details: details,
      rejection_date: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });

    // TODO: Trigger Power Automate - Send rejection email
    console.log(`✉️ Rejection email should be sent for employee ${employeeId}`);

    respondSuccess(res, {
      message: 'Candidate rejected',
      reason: reason
    });

  } catch (error) {
    console.error('❌ Reject candidate error:', error);
    respondError(res, error.message, 500);
  }
}

module.exports = {
  getPendingRegistrations,
  getVerificationDetails,
  approveCandidate,
  rejectCandidate
};
