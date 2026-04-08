import json
from datetime import datetime

from odoo import api, fields, models


class HrEmployeeCustom(models.Model):
    _inherit = "hr.employee"

    # ============================================
    # ONBOARDING STATUS FIELDS
    # ============================================

    onboarding_status = fields.Selection(
        [
            ("not_started", "Not Started"),
            ("initiated", "Initiated"),
            ("documents_submitted", "Documents Submitted"),
            ("verification_pending", "Verification Pending"),
            ("verified", "Verified"),
            ("provisioning", "Provisioning"),
            ("activated", "Activated"),
            ("rejected", "Rejected"),
            ("expired", "Expired"),
        ],
        string="Onboarding Status",
        default="not_started",
        readonly=True,
        tracking=True,
    )

    onboarding_progress_percentage = fields.Float(
        string="Onboarding Progress (%)",
        compute="_compute_onboarding_progress",
        store=True,
    )

    onboarding_initiated_date = fields.Datetime(
        string="Onboarding Initiated",
        readonly=True,
    )

    onboarding_completed_date = fields.Datetime(
        string="Onboarding Completed",
        readonly=True,
    )

    # ============================================
    # N8N AUTOMATION FIELDS
    # ============================================

    employee_type = fields.Selection(
        [
            ("office", "Office"),
            ("shop_floor", "Shop Floor"),
        ],
        string="Employee Type",
        help="Determines registration form variant and required documents",
    )

    manual_review_required = fields.Boolean(
        string="Require Manual Approval",
        default=False,
        help="HR flag to force manual review even if automated checks pass",
    )

    auto_approved = fields.Boolean(
        string="Auto-Approved",
        default=False,
        readonly=True,
        help="True if onboarding was auto-approved by n8n without HR intervention",
    )

    cnic_verified = fields.Boolean(
        string="CNIC Number Verified",
        default=False,
        readonly=True,
        help="True if OCR-extracted CNIC number matched candidate's entered CNIC number",
    )

    # ============================================
    # BANK DETAILS (for salary disbursement)
    # ============================================

    bank_name = fields.Char(
        string="Bank Name",
    )

    bank_account_number = fields.Char(
        string="Bank Account Number",
    )

    bank_iban = fields.Char(
        string="IBAN",
    )

    # ============================================
    # EMERGENCY CONTACT
    # ============================================

    emergency_contact_name = fields.Char(
        string="Emergency Contact Name",
    )

    emergency_contact_relationship = fields.Char(
        string="Emergency Contact Relationship",
    )

    emergency_contact_phone = fields.Char(
        string="Emergency Contact Phone",
    )

    # ============================================
    # DOCUMENT VERIFICATION FLAGS
    # ============================================

    documents_verified = fields.Boolean(
        string="Documents Verified",
        default=False,
    )

    cnic_uploaded = fields.Boolean(
        string="CNIC Uploaded",
        default=False,
    )

    degree_uploaded = fields.Boolean(
        string="Degree Uploaded",
        default=False,
    )

    medical_uploaded = fields.Boolean(
        string="Medical Certificate Uploaded",
        default=False,
    )

    # ============================================
    # AI VERIFICATION FIELDS
    # ============================================

    ai_verification_status = fields.Selection(
        [("pending", "Pending"), ("passed", "Passed"), ("failed", "Failed")],
        string="AI Verification Status",
        default="pending",
        tracking=True,
    )

    ai_verification_score = fields.Float(
        string="AI Verification Score",
        help="AI confidence score (0-100)",
        default=0.0,
    )

    ai_verification_details = fields.Text(
        string="AI Verification Details",
        help="JSON with detailed verification results",
    )

    ai_verification_date = fields.Datetime(
        string="AI Verification Date",
        readonly=True,
    )

    # ============================================
    # EXTRACTED CNIC DATA (from AI)
    # ============================================

    extracted_name = fields.Char(
        string="Extracted Name (OCR)", help="Name extracted from CNIC via AI"
    )

    extracted_cnic_number = fields.Char(
        string="Extracted CNIC (OCR)", help="CNIC number extracted from uploaded image"
    )

    extracted_father_name = fields.Char(
        string="Extracted Father Name (OCR)",
    )

    extracted_dob = fields.Date(
        string="Extracted Date of Birth (OCR)",
    )

    ocr_confidence = fields.Float(
        string="OCR Confidence",
        help="Overall confidence of OCR extraction (0-100)",
    )

    # ============================================
    # USER-ENTERED DATA (from registration form)
    # ============================================

    entered_cnic_number = fields.Char(
        string="Entered CNIC Number",
        help="CNIC number entered by candidate during registration",
    )

    entered_father_name = fields.Char(
        string="Entered Father Name",
    )

    private_email = fields.Char(
        string="Personal Email", help="Candidate's personal email for communication"
    )

    # ============================================
    # HR MANUAL VERIFICATION FIELDS
    # ============================================

    hr_verification_status = fields.Selection(
        [
            ("pending", "Pending Review"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
        ],
        string="HR Verification Status",
        default="pending",
        tracking=True,
    )

    hr_verification_notes = fields.Text(
        string="HR Verification Notes", help="Manual verification notes by HR staff"
    )

    hr_verified_by = fields.Many2one(
        "res.users",
        string="Verified By",
        readonly=True,
    )

    hr_verified_date = fields.Datetime(
        string="HR Verification Date",
        readonly=True,
    )

    # ============================================
    # REJECTION HANDLING
    # ============================================

    rejection_reason = fields.Selection(
        [
            ("cnic_mismatch", "CNIC Information Mismatch"),
            ("name_mismatch", "Name Mismatch"),
            ("dob_mismatch", "Date of Birth Mismatch"),
            ("invalid_documents", "Invalid or Unclear Documents"),
            ("wrong_department", "Incorrect Department/Role Selection"),
            ("duplicate_entry", "Duplicate Registration"),
            ("failed_background_check", "Failed Background Check"),
            ("other", "Other Reason"),
        ],
        string="Rejection Reason",
    )

    rejection_details = fields.Text(
        string="Rejection Details", help="Detailed explanation for rejection"
    )

    rejection_date = fields.Datetime(
        string="Rejection Date",
        readonly=True,
    )

    # ============================================
    # HR-ASSIGNED DEPARTMENT/POSITION TRACKING
    # ============================================

    hr_assigned_department_id = fields.Many2one(
        "hr.department",
        string="HR Assigned Department",
        help="Department assigned by HR during onboarding initiation",
    )

    hr_assigned_job_id = fields.Many2one(
        "hr.job",
        string="HR Assigned Position",
        help="Position assigned by HR during onboarding initiation",
    )

    # ============================================
    # PROVISIONING FLAGS
    # ============================================

    email_provisioned = fields.Boolean(
        string="Work Email Provisioned",
        default=False,
    )

    system_access_provisioned = fields.Boolean(
        string="System Access Granted",
        default=False,
    )

    orientation_completed = fields.Boolean(
        string="Orientation Completed",
        default=False,
    )

    # Add to the class HrEmployeeCustom
    registration_password_hash = fields.Char(
        string="Registration Password Hash",
        help="Temporary storage of registration password until account activation",
    )

    # ============================================
    # COMPUTED FIELDS
    # ============================================

    @api.depends(
        "cnic_uploaded",
        "degree_uploaded",
        "medical_uploaded",
        "ai_verification_status",
        "hr_verification_status",
        "email_provisioned",
        "orientation_completed",
    )
    def _compute_onboarding_progress(self):
        """Calculate onboarding completion percentage"""
        for record in self:
            progress = 0.0

            # Documents uploaded (30%)
            if record.cnic_uploaded:
                progress += 10
            if record.degree_uploaded:
                progress += 10
            if record.medical_uploaded:
                progress += 10

            # AI verification passed (20%)
            if record.ai_verification_status == "passed":
                progress += 20

            # HR verification approved (20%)
            if record.hr_verification_status == "approved":
                progress += 20

            # Email provisioned (15%)
            if record.email_provisioned:
                progress += 15

            # Orientation completed (15%)
            if record.orientation_completed:
                progress += 15

            record.onboarding_progress_percentage = progress

    # ============================================
    # STATE TRANSITION LOGIC
    # ============================================

    def _update_onboarding_status(self):
        """
        Automatically update onboarding status based on verification states
        Called after AI verification or HR approval
        """
        for record in self:
            # Rule 1: Both verifications passed → Verified
            if (
                record.ai_verification_status == "passed"
                and record.hr_verification_status == "approved"
            ):
                record.write(
                    {
                        "onboarding_status": "verified",
                    }
                )
                # Trigger email provisioning (Power Automate webhook)
                self._trigger_provisioning_flow(record)

            # Rule 2: Either verification failed → Rejected
            elif (
                record.ai_verification_status == "failed"
                or record.hr_verification_status == "rejected"
            ):
                record.write(
                    {
                        "onboarding_status": "rejected",
                        "rejection_date": datetime.now(),
                    }
                )
                # Trigger rejection email (Power Automate webhook)
                self._trigger_rejection_flow(record)

            # Rule 3: Waiting for verifications → Verification Pending
            elif (
                record.ai_verification_status == "pending"
                or record.hr_verification_status == "pending"
            ):
                if record.onboarding_status == "documents_submitted":
                    record.onboarding_status = "verification_pending"

    def _trigger_provisioning_flow(self, record):
        """Trigger Power Automate flow for email provisioning"""
        # This will be called by the backend API
        pass

    def _trigger_rejection_flow(self, record):
        """Trigger Power Automate flow for rejection notification"""
        # This will be called by the backend API
        pass

    # ============================================
    # HELPER METHODS FOR API
    # ============================================

    def set_ai_verification_result(self, verification_data):
        """
        Update employee with AI verification results
        Called by backend after OCR + matching
        """
        self.ensure_one()

        self.write(
            {
                "ai_verification_status": verification_data.get("status", "pending"),
                "ai_verification_score": verification_data.get("score", 0.0),
                "ai_verification_details": json.dumps(
                    verification_data.get("details", {})
                ),
                "ai_verification_date": datetime.now(),
                "extracted_name": verification_data.get("extracted_name"),
                "extracted_cnic_number": verification_data.get("extracted_cnic"),
                "extracted_father_name": verification_data.get("extracted_father_name"),
                "extracted_dob": verification_data.get("extracted_dob"),
                "ocr_confidence": verification_data.get("ocr_confidence", 0.0),
            }
        )

        # Check if we should update onboarding status
        self._update_onboarding_status()

        return True

    def set_hr_verification_result(self, approved, notes, verified_by_uid):
        """
        Update employee with HR verification decision
        Called when HR approves/rejects
        """
        self.ensure_one()

        status = "approved" if approved else "rejected"

        self.write(
            {
                "hr_verification_status": status,
                "hr_verification_notes": notes,
                "hr_verified_by": verified_by_uid,
                "hr_verified_date": datetime.now(),
            }
        )

        # Check if we should update onboarding status
        self._update_onboarding_status()

        return True
