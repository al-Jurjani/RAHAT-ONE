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

    console.log('📋 Getting verification details for employee:', employeeId);

    // Get employee details from Odoo
    const employee = await odooAdapter.getEmployee(parseInt(employeeId));

    console.log('👤 Employee found:', employee ? employee.name : 'NULL');

    if (!employee) {
      console.error('❌ Employee not found in Odoo:', employeeId);
      return respondError(res, 'Employee not found', 404);
    }

    // Parse AI verification details (with null check)
    let aiVerificationDetails = null;
    if (employee.ai_verification_details) {
      try {
        aiVerificationDetails = JSON.parse(employee.ai_verification_details);
      } catch (parseError) {
        console.warn('⚠️ Could not parse AI verification details:', parseError);
        aiVerificationDetails = null;
      }
    }

    // Get uploaded documents
    console.log('📄 Getting documents for employee:', employeeId);
    const documents = await odooAdapter.getEmployeeDocuments(employeeId);
    console.log('📄 Documents found:', documents.length);

    // Format response
    const response = {
      employee: {
        id: employee.id,
        name: employee.name,
        personalEmail: employee.private_email,
        workEmail: employee.work_email,
        phone: employee.mobile_phone,
        cnic: employee.cnic_number,
        fatherName: employee.father_name,
        dateOfBirth: employee.birthday,
        department: employee.department_id ? employee.department_id[1] : 'N/A',
        position: employee.job_id ? employee.job_id[1] : 'N/A',
        onboardingStatus: employee.onboarding_status,
        submittedAt: employee.onboarding_initiated_date
      },
      aiVerification: {
        status: employee.ai_verification_status || 'pending',
        score: employee.ai_verification_score || 0,
        details: aiVerificationDetails || {
          name: { score: 0, match: false },
          cnic: { score: 0, match: false },
          dob: { score: 0, match: false }
        },
        verifiedAt: employee.ai_verification_date,
        extractedData: {
          name: employee.extracted_name || 'N/A',
          cnicNumber: employee.extracted_cnic_number || 'N/A',
          fatherName: employee.extracted_father_name || 'N/A',
          dob: employee.extracted_dob || 'N/A',
          confidence: employee.ocr_confidence || 0
        }
      },
      hrVerification: {
        status: employee.hr_verification_status || 'pending',
        verifiedBy: employee.hr_verified_by || null,
        verifiedAt: employee.hr_verification_date || null,
        rejectionReason: employee.hr_rejection_reason || null,
        rejectionDetails: employee.hr_rejection_details || null,
        notes: employee.hr_verification_notes || null
      },
      documents: documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.mimetype,
        uploadedAt: doc.create_date
      }))
    };

    console.log('✅ Sending response with employee:', response.employee.name);
    console.log('✅ Response structure:', JSON.stringify(response, null, 2));

    return respondSuccess(res, response);

  } catch (error) {
    console.error('❌ Get verification details error:', error);
    return respondError(res, 'Failed to get verification details', 500);
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
