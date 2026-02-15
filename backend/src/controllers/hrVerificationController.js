const odooAdapter = require('../adapters/odooAdapter');
const { respondSuccess, respondError } = require('../utils/responseHandler');
const powerAutomateService = require('../services/powerAutomateService');

/**
 * Get all pending registrations for HR review
 */
async function getPendingRegistrations(req, res) {
  try {
    // Search for employees with documents submitted or verification pending
    const employeeIds = await odooAdapter.searchEmployees([
      ['onboarding_status', 'in', ['documents_submitted', 'verification_pending', 'registered']]  // ✅ Add 'registered'
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
        aiVerificationStatus: emp.ai_verification_status || 'pending',  // ✅ Flat field
        aiVerificationScore: emp.ai_verification_score || 0,            // ✅ Flat field
        aiVerificationDate: emp.ai_verification_date,
        hrVerificationStatus: emp.hr_verification_status || 'pending',  // ✅ Flat field
        documentsUploaded: {
          cnic: emp.cnic_uploaded,
          degree: emp.degree_uploaded,
          medical: emp.medical_uploaded
        },
        submittedAt: emp.create_date  // ✅ Match frontend field name
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

    // 🆕 ADD THIS DEBUG BLOCK
    console.log('🔍 RAW ODOO DATA - HR Assigned Fields:');
    console.log('   hr_assigned_department_id:', employee.hr_assigned_department_id);
    console.log('   hr_assigned_job_id:', employee.hr_assigned_job_id);
    console.log('   department_id:', employee.department_id);
    console.log('   job_id:', employee.job_id);

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
        cnic: employee.cnic_number || employee.entered_cnic_number || 'N/A',
        fatherName: employee.father_name || employee.entered_father_name || 'N/A',
        dateOfBirth: employee.birthday,
        department: employee.department_id ? employee.department_id[1] : 'N/A',
        departmentId: employee.department_id ? employee.department_id[0] : null,
        position: employee.job_id ? employee.job_id[1] : 'N/A',
        positionId: employee.job_id ? employee.job_id[0] : null,
        hrAssignedDepartment: employee.hr_assigned_department_id ? employee.hr_assigned_department_id[1] : null,
        hrAssignedDepartmentId: employee.hr_assigned_department_id ? employee.hr_assigned_department_id[0] : null,
        hrAssignedPosition: employee.hr_assigned_job_id ? employee.hr_assigned_job_id[1] : null,
        hrAssignedPositionId: employee.hr_assigned_job_id ? employee.hr_assigned_job_id[0] : null,
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
    const employeeId = parseInt(req.params.employeeId);
    const { notes } = req.body;

    console.log('📥 Received approval request for employee:', employeeId);
    console.log('📝 Notes:', notes);

    if (!employeeId) {
      return respondError(res, 'Employee ID is required', 400);
    }

    console.log('✅ Approving candidate:', employeeId);

    // Get employee details including password hash
    const employee = await odooAdapter.execute('hr.employee', 'read', [
      [employeeId],
      [
        'name',
        'work_email',
        'private_email',
        'registration_password_hash',
        'department_id',
        'job_id'
      ]
    ]);

    if (!employee || employee.length === 0) {
      return respondError(res, 'Employee not found', 404);
    }

    const emp = employee[0];

    // Update HR verification status to approved
    await odooAdapter.updateEmployee(employeeId, {
      hr_verification_status: 'approved',
      hr_verification_notes: notes || '',
      hr_verified_by: 2, // Admin user ID
      hr_verified_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      onboarding_status: 'verified'
    });

    console.log('✅ Employee verified in Odoo');

    // CREATE LOGIN ACCOUNT
    try {
      const existingUsers = await odooAdapter.execute('res.users', 'search_read', [
        [['employee_id', '=', employeeId]],
        ['id']
      ]);

      if (existingUsers.length === 0 && emp.registration_password_hash && emp.work_email) {
        console.log('🔐 Creating login account for:', emp.work_email);

        const userId = await odooAdapter.execute('res.users', 'create', [
          {
            name: emp.name,
            login: emp.work_email,
            email: emp.work_email,
            rahatone_role: 'employee',
            is_rahatone_user: true,
            employee_id: employeeId,
            account_status: 'active',
            password_hash: emp.registration_password_hash
          }
        ]);

        console.log('✅ Login account created! User ID:', userId);

        // 🆕 LINK USER TO EMPLOYEE RECORD
        try {
          await odooAdapter.execute('hr.employee', 'write', [
            [parseInt(employeeId)],
            {
              user_id: userId,
              work_email: emp.work_email
            }
          ]);
          console.log('✅ Employee record linked to user account');
        } catch (linkError) {
          console.error('⚠️ Warning: Failed to link user to employee:', linkError.message);
          // Don't fail the entire approval if linking fails
        }

      } else {
        console.log('ℹ️  User account already exists or missing data');
      }
    } catch (userError) {
      console.error('⚠️  Failed to create user account:', userError.message);
    }

    // 🆕 ALLOCATE INITIAL LEAVES
    let leaveAllocations = [];
    try {
      console.log('🎯 Starting leave allocation...');
      const onboardingService = require('../services/onboardingService');
      const allocationResult = await onboardingService.allocateInitialLeaves(employeeId);
      leaveAllocations = allocationResult.allocations;
      console.log('✅ Leave allocation successful:', leaveAllocations);
    } catch (leaveError) {
      console.error('⚠️  Leave allocation failed:', leaveError.message);
      // Don't fail the approval if leave allocation fails
      // HR can manually allocate later
    }

    // Extract department and position names
    const departmentName = emp.department_id ? emp.department_id[1] : 'N/A';
    const positionName = emp.job_id ? emp.job_id[1] : 'N/A';

    // Prepare leave balances for email
    const leaveBalances = {};
    leaveAllocations.forEach(allocation => {
      leaveBalances[allocation.leaveType] = allocation.days;
    });

    // Trigger Power Automate approval email
    console.log('🔔 Attempting to send approval email...');
    powerAutomateService.sendApprovalEmail({
      id: employeeId,
      name: emp.name,
      personalEmail: emp.private_email,
      workEmail: emp.work_email,
      department: departmentName || 'N/A',
      position: positionName || 'N/A',
      leaveBalances: leaveBalances // 🆕 Add leave balances to payload
    }, notes || '')
      .then(() => console.log('✅ Approval email sent'))
      .catch(err => {
        console.error('❌ Approval email error:');
        console.error('   Message:', err.message);
        console.error('   Response:', err.response?.data);
      });

    return respondSuccess(res, {
      employeeId,
      status: 'approved',
      userAccountCreated: true,
      leaveAllocations: leaveAllocations // 🆕 Return allocation info
    }, 'Candidate approved successfully');

  } catch (error) {
    console.error('❌ Approval error:', error);
    return respondError(res, 'Failed to approve candidate', 500, error);
  }
}

/**
 * HR rejects candidate
 */
async function rejectCandidate(req, res) {
  try {
    const { employeeId } = req.params;
    const { reason, details } = req.body;

    const id = parseInt(employeeId);

    // Get employee data first
    const employee = await odooAdapter.getEmployee(id);

    // Update in Odoo
    await odooAdapter.updateEmployee(id, {
      hr_verification_status: 'rejected',
      rejection_reason: reason,
      rejection_details: details || '',
      rejection_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      onboarding_status: 'rejected',
      active: false
    });

    // Trigger Power Automate rejection email
    await powerAutomateService.sendRejectionEmail({
      id: employee.id,
      name: employee.name,
      personalEmail: employee.private_email,
      department: employee.department_id?.[1] || 'N/A',
      position: employee.job_id?.[1] || 'N/A'
    }, reason, details);

    console.log('✅ Employee rejected successfully');

    return respondSuccess(res, {
      message: 'Employee rejected successfully',
      employeeId: id
    });

  } catch (error) {
    console.error('❌ Reject verification error:', error);
    return respondError(res, error.message || 'Failed to reject verification', 500);
  }
}

/**
 * Get recently approved employees
 */
async function getApprovedEmployees(req, res) {
  try {
    console.log('📋 Fetching approved employees...');

    const employees = await odooAdapter.searchAndReadEmployees([
      ['hr_verification_status', '=', 'approved'],
      ['hr_verified_date', '!=', false]
    ], {
      order: 'hr_verified_date desc',
      limit: 50
    });

    console.log(`✅ Found ${employees.length} approved employees`);

    const formattedList = employees.map(emp => ({
      id: emp.id,
      name: emp.name,
      personalEmail: emp.private_email,
      workEmail: emp.work_email,
      department: emp.department_id ? emp.department_id[1] : 'N/A',
      position: emp.job_id ? emp.job_id[1] : 'N/A',
      onboardingStatus: emp.onboarding_status,
      aiVerificationStatus: emp.ai_verification_status,
      hrVerificationStatus: emp.hr_verification_status,
      submittedAt: emp.onboarding_initiated_date,
      approvedAt: emp.hr_verified_date
    }));

    return respondSuccess(res, formattedList);

  } catch (error) {
    console.error('❌ Get approved employees error:', error.message);
    return respondError(res, error.message || 'Failed to get approved employees', 500);
  }
}

/**
 * Get recently rejected employees
 */
async function getRejectedEmployees(req, res) {
  try {
    const employees = await odooAdapter.searchAndReadEmployees([
      ['hr_verification_status', '=', 'rejected']
    ], {
      order: 'rejection_date desc',
      limit: 50,
      includeInactive: true  // Include inactive records (rejected employees are set to inactive)
    });

    console.log(`✅ Found ${employees.length} rejected employees`);

    const formattedList = employees.map(emp => ({
      id: emp.id,
      name: emp.name,
      personalEmail: emp.private_email,
      workEmail: emp.work_email,
      department: emp.department_id ? emp.department_id[1] : 'N/A',
      position: emp.job_id ? emp.job_id[1] : 'N/A',
      onboardingStatus: emp.onboarding_status,
      aiVerificationStatus: emp.ai_verification_status,
      hrVerificationStatus: emp.hr_verification_status,
      submittedAt: emp.onboarding_initiated_date,
      rejectedAt: emp.rejection_date,
      rejectionReason: emp.rejection_reason
    }));

    return respondSuccess(res, formattedList);

  } catch (error) {
    console.error('❌ Get rejected employees error:', error);
    return respondError(res, 'Failed to get rejected employees', 500);
  }
}

/**
 * Get document binary data for viewing/download
 */
async function getDocument(req, res) {
  try {
    const { documentId } = req.params;

    // Validate documentId is a number
    const id = parseInt(documentId);
    if (isNaN(id) || id <= 0) {
      return respondError(res, 'Invalid document ID', 400);
    }

    console.log('📄 Fetching document:', id);

    // Fetch document from Odoo ir.attachment
    const documents = await odooAdapter.execute(
      'ir.attachment',
      'read',
      [[id], ['id', 'name', 'mimetype', 'datas']]
    );

    if (!documents || documents.length === 0) {
      console.error('❌ Document not found:', id);
      return respondError(res, 'Document not found', 404);
    }

    const doc = documents[0];

    // Check if document has data
    if (!doc.datas) {
      console.error('❌ Document has no data:', id);
      return respondError(res, 'Document has no data', 404);
    }

    console.log('✅ Document found:', doc.name, 'Type:', doc.mimetype);

    // Convert base64 to binary buffer
    const fileBuffer = Buffer.from(doc.datas, 'base64');

    // Set response headers for inline viewing
    res.set({
      'Content-Type': doc.mimetype,
      'Content-Disposition': `inline; filename="${doc.name}"`,
      'Content-Length': fileBuffer.length,
      'Cache-Control': 'private, max-age=3600'
    });

    // Send binary data
    return res.send(fileBuffer);

  } catch (error) {
    console.error('❌ Get document error:', error);
    return respondError(res, 'Failed to retrieve document', 500);
  }
}

/**
 * Override candidate's department/position selection with HR's original assignment
 * PUT /api/hr/verification/:employeeId/override-assignment
 */
async function overrideAssignment(req, res) {
  try {
    const { employeeId } = req.params;
    const { useHRAssignment } = req.body; // true = use HR's, false = keep candidate's

    const id = parseInt(employeeId);

    console.log('🔄 Override assignment request:', { employeeId: id, useHRAssignment });

    // Get employee data
    const employee = await odooAdapter.getEmployee(id);

    if (!employee) {
      return respondError(res, 'Employee not found', 404);
    }

    let updateData = {};

    if (useHRAssignment) {
      // Override with HR's original assignment
      if (employee.hr_assigned_department_id) {
        updateData.department_id = employee.hr_assigned_department_id[0];
        console.log('   Setting department to HR assigned:', employee.hr_assigned_department_id);
      }
      if (employee.hr_assigned_job_id) {
        updateData.job_id = employee.hr_assigned_job_id[0];
        console.log('   Setting position to HR assigned:', employee.hr_assigned_job_id);
      }
    }

    if (Object.keys(updateData).length === 0) {
      return respondError(res, 'No HR assignment found to override', 400);
    }

    // Update employee record
    await odooAdapter.updateEmployee(id, updateData);

    console.log('✅ Assignment overridden successfully');

    return respondSuccess(res, {
      employeeId: id,
      message: useHRAssignment
        ? 'Assignment overridden with HR values'
        : 'Candidate selection accepted',
      updatedFields: updateData
    });

  } catch (error) {
    console.error('❌ Override assignment error:', error);
    return respondError(res, 'Failed to override assignment', 500);
  }
}


module.exports = {
  getPendingRegistrations,
  getApprovedEmployees,
  getRejectedEmployees,
  getVerificationDetails,
  getDocument,
  approveCandidate,
  rejectCandidate,
  overrideAssignment
};
