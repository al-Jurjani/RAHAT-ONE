# -*- coding: utf-8 -*-
import json
import secrets
from datetime import datetime, timedelta

from odoo import api, fields, models
from odoo.exceptions import ValidationError


class HrExpenseInherit(models.Model):
    _inherit = "hr.expense"

    # ============================================
    # EXPENSE CATEGORY & BASIC INFO
    # ============================================

    expense_category = fields.Selection(
        [
            ("medical", "Medical"),
            ("petrol", "Petrol"),
            ("travel", "Travel"),
            ("other", "Other"),
        ],
        string="Expense Category",
        required=True,
        default="other",
        tracking=True,
    )

    vendor_name = fields.Char(
        string="Vendor Name",
        help="Name of the vendor/merchant",
    )

    expense_date = fields.Date(
        string="Expense Date",
        default=fields.Date.context_today,
        required=True,
    )

    # ============================================
    # FRAUD DETECTION FIELDS (existing + enhanced)
    # ============================================

    document_hash = fields.Char(
        string="Document Hash (MD5)",
        help="MD5 hash of the uploaded document for exact duplicate detection",
        readonly=True,
        index=True,
    )

    perceptual_hash = fields.Char(
        string="Perceptual Hash",
        help="Perceptual hash for visual similarity detection",
        readonly=True,
        index=True,
    )

    fraud_score = fields.Float(
        string="Legacy Fraud Score (V1)",
        help="Legacy numeric score retained for backward compatibility with older records",
        default=0.0,
        readonly=True,
    )

    fraud_detection_status = fields.Selection(
        [
            ("pending", "Pending Verification"),
            ("clean", "Verified Clean"),
            ("suspicious", "Suspicious - Review Required"),
            ("fraudulent", "Fraudulent - Rejected"),
        ],
        string="Fraud Status",
        default="pending",
        readonly=True,
        tracking=True,
    )

    fraud_detection_details = fields.Text(
        string="Detection Details",
        help="JSON string containing detailed fraud detection results",
        readonly=True,
    )

    duplicate_of_expense_id = fields.Many2one(
        "hr.expense",
        string="Duplicate Of",
        help="Reference to original expense if this is detected as duplicate",
        readonly=True,
    )

    ai_verification_date = fields.Datetime(
        string="AI Verification Date",
        help="Timestamp when AI fraud detection was performed",
        readonly=True,
    )

    anomaly_confidence = fields.Float(
        string="Anomaly Confidence",
        help="ML-based anomaly detection confidence score",
        default=0.0,
        readonly=True,
    )

    clip_embedding = fields.Text(
        string="CLIP Embedding",
        help="512-dimensional CLIP visual embedding (JSON array) for similarity detection",
        readonly=True,
    )

    florence_analysis = fields.Text(
        string="Florence-2 Analysis",
        help="Document analysis from Florence-2 vision-language model for forgery detection",
        readonly=True,
    )

    # ============================================
    # POLICY VALIDATION FIELDS
    # ============================================

    policy_check_passed = fields.Boolean(
        string="Policy Check Passed",
        default=False,
        readonly=True,
    )

    policy_check_details = fields.Text(
        string="Policy Check Details",
        help="JSON with detailed policy validation results",
        readonly=True,
    )

    policy_check_date = fields.Datetime(
        string="Policy Check Date",
        readonly=True,
    )

    # ============================================
    # MANAGER APPROVAL FIELDS
    # ============================================

    manager_approved = fields.Boolean(
        string="Manager Approved",
        default=False,
        readonly=True,
    )

    manager_approved_by = fields.Many2one(
        "res.users",
        string="Manager Approved By",
        readonly=True,
    )

    manager_approved_date = fields.Datetime(
        string="Manager Approval Date",
        readonly=True,
    )

    manager_remarks = fields.Text(
        string="Manager Remarks",
        help="Comments from manager during approval/rejection",
    )

    manager_decision = fields.Selection(
        [
            ("pending", "Pending"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
        ],
        string="Manager Decision",
        default="pending",
        tracking=True,
    )

    # ============================================
    # HR ESCALATION & APPROVAL FIELDS
    # ============================================

    hr_escalated = fields.Boolean(
        string="Escalated to HR",
        default=False,
        help="True if expense amount exceeds threshold and requires HR approval",
        readonly=True,
    )

    hr_escalation_reason = fields.Char(
        string="Escalation Reason",
        readonly=True,
    )

    hr_approved = fields.Boolean(
        string="HR Approved",
        default=False,
        readonly=True,
    )

    hr_approved_by = fields.Many2one(
        "res.users",
        string="HR Approved By",
        readonly=True,
    )

    hr_approved_date = fields.Datetime(
        string="HR Approval Date",
        readonly=True,
    )

    hr_remarks = fields.Text(
        string="HR Remarks",
        help="Comments from HR during approval/rejection",
    )

    hr_decision = fields.Selection(
        [
            ("not_required", "Not Required"),
            ("pending", "Pending"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
        ],
        string="HR Decision",
        default="not_required",
        tracking=True,
    )

    # ============================================
    # APPROVAL TOKEN FIELDS (for secure email links)
    # ============================================

    approval_token = fields.Char(
        string="Approval Token",
        help="Secure token for email-based approval links",
        readonly=True,
        copy=False,
    )

    approval_token_expiry = fields.Datetime(
        string="Token Expiry",
        readonly=True,
    )

    approval_token_type = fields.Selection(
        [
            ("manager", "Manager Approval"),
            ("hr", "HR Approval"),
        ],
        string="Token Type",
        readonly=True,
    )

    # ============================================
    # WORKFLOW STATUS TRACKING
    # ============================================

    workflow_status = fields.Selection(
        [
            ("draft", "Draft"),
            ("submitted", "Submitted"),
            ("policy_check", "Policy Check"),
            ("pending_manager", "Pending Manager Approval"),
            ("pending_hr", "Pending HR Approval"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
        ],
        string="Workflow Status",
        default="draft",
        tracking=True,
    )

    rejection_reason = fields.Selection(
        [
            ("policy_violation", "Policy Violation"),
            ("manager_rejected", "Rejected by Manager"),
            ("hr_rejected", "Rejected by HR"),
            ("fraud_detected", "Fraud Detected"),
            ("invalid_documents", "Invalid Documents"),
            ("duplicate_claim", "Duplicate Claim"),
            ("other", "Other"),
        ],
        string="Rejection Reason",
    )

    rejection_details = fields.Text(
        string="Rejection Details",
    )

    # ============================================
    # TIMESTAMPS
    # ============================================

    submitted_date = fields.Datetime(
        string="Submitted Date",
        readonly=True,
    )

    completed_date = fields.Datetime(
        string="Completed Date",
        help="Date when expense was finally approved or rejected",
        readonly=True,
    )

    # ============================================
    # COMPUTED FIELDS
    # ============================================

    is_high_value = fields.Boolean(
        string="High Value Expense",
        compute="_compute_is_high_value",
        store=True,
        help="True if expense amount exceeds HR escalation threshold",
    )

    days_pending = fields.Integer(
        string="Days Pending",
        compute="_compute_days_pending",
        help="Number of days since submission",
    )

    @api.depends("total_amount")
    def _compute_is_high_value(self):
        """Check if expense exceeds HR escalation threshold (PKR 10,000)"""
        HR_ESCALATION_THRESHOLD = 10000  # Configurable later
        for record in self:
            record.is_high_value = record.total_amount > HR_ESCALATION_THRESHOLD

    @api.depends("submitted_date", "workflow_status")
    def _compute_days_pending(self):
        """Calculate days since submission"""
        for record in self:
            if record.submitted_date and record.workflow_status not in [
                "approved",
                "rejected",
                "draft",
            ]:
                delta = datetime.now() - record.submitted_date
                record.days_pending = delta.days
            else:
                record.days_pending = 0

    # ============================================
    # TOKEN MANAGEMENT METHODS
    # ============================================

    def generate_approval_token(self, token_type="manager", expiry_hours=48):
        """
        Generate a secure approval token for email-based approvals

        Args:
            token_type: 'manager' or 'hr'
            expiry_hours: Token validity in hours (default 48)

        Returns:
            Generated token string
        """
        self.ensure_one()
        token = secrets.token_urlsafe(32)
        expiry = datetime.now() + timedelta(hours=expiry_hours)

        self.write(
            {
                "approval_token": token,
                "approval_token_expiry": expiry,
                "approval_token_type": token_type,
            }
        )

        return token

    def validate_approval_token(self, token, expected_type=None):
        """
        Validate an approval token

        Args:
            token: Token string to validate
            expected_type: Expected token type ('manager' or 'hr')

        Returns:
            True if valid, raises ValidationError if invalid
        """
        self.ensure_one()

        if not self.approval_token or self.approval_token != token:
            raise ValidationError("Invalid approval token")

        if self.approval_token_expiry and datetime.now() > self.approval_token_expiry:
            raise ValidationError("Approval token has expired")

        if expected_type and self.approval_token_type != expected_type:
            raise ValidationError(f"Invalid token type. Expected {expected_type}")

        return True

    def clear_approval_token(self):
        """Clear the approval token after use"""
        self.ensure_one()
        self.write(
            {
                "approval_token": False,
                "approval_token_expiry": False,
                "approval_token_type": False,
            }
        )

    # ============================================
    # WORKFLOW STATE TRANSITION METHODS
    # ============================================

    def action_submit(self):
        """Submit expense for approval"""
        self.ensure_one()
        if self.workflow_status != "draft":
            raise ValidationError("Only draft expenses can be submitted")

        self.write(
            {
                "workflow_status": "submitted",
                "submitted_date": datetime.now(),
            }
        )
        return True

    def action_mark_policy_checked(self, passed, details=None):
        """
        Mark expense as policy checked

        Args:
            passed: Boolean - whether policy check passed
            details: Dict - detailed policy check results
        """
        self.ensure_one()

        self.write(
            {
                "policy_check_passed": passed,
                "policy_check_details": json.dumps(details) if details else None,
                "policy_check_date": datetime.now(),
                "workflow_status": "pending_manager" if passed else "rejected",
            }
        )

        if not passed:
            self.write(
                {
                    "rejection_reason": "policy_violation",
                    "rejection_details": details.get("message")
                    if details
                    else "Policy check failed",
                    "completed_date": datetime.now(),
                    "state": "refused",
                }
            )

        return passed

    def action_set_hr_escalation(self, reason=None):
        """Mark expense as requiring HR approval"""
        self.ensure_one()
        self.write(
            {
                "hr_escalated": True,
                "hr_escalation_reason": reason or f"Amount exceeds threshold",
                "hr_decision": "pending",
            }
        )
        return True

    def action_manager_decision(self, approved, remarks=None, manager_user_id=None):
        """
        Record manager's decision

        Args:
            approved: Boolean
            remarks: Optional comments
            manager_user_id: ID of the manager user
        """
        self.ensure_one()

        if self.workflow_status != "pending_manager":
            raise ValidationError("Expense is not pending manager approval")

        decision = "approved" if approved else "rejected"

        update_vals = {
            "manager_decision": decision,
            "manager_approved": approved,
            "manager_approved_date": datetime.now(),
            "manager_remarks": remarks,
        }

        if manager_user_id:
            update_vals["manager_approved_by"] = manager_user_id

        if approved:
            if self.hr_escalated:
                # Need HR approval next
                update_vals["workflow_status"] = "pending_hr"
            else:
                # Final approval
                update_vals["workflow_status"] = "approved"
                update_vals["state"] = "approved"
                update_vals["completed_date"] = datetime.now()
        else:
            # Rejected by manager
            update_vals["workflow_status"] = "rejected"
            update_vals["state"] = "refused"
            update_vals["rejection_reason"] = "manager_rejected"
            update_vals["rejection_details"] = remarks or "Rejected by manager"
            update_vals["completed_date"] = datetime.now()

        self.write(update_vals)
        self.clear_approval_token()

        return True

    def action_hr_decision(self, approved, remarks=None, hr_user_id=None):
        """
        Record HR's decision (for escalated expenses)

        Args:
            approved: Boolean
            remarks: Optional comments
            hr_user_id: ID of the HR user
        """
        self.ensure_one()

        if self.workflow_status != "pending_hr":
            raise ValidationError("Expense is not pending HR approval")

        if not self.hr_escalated:
            raise ValidationError("This expense was not escalated to HR")

        decision = "approved" if approved else "rejected"

        update_vals = {
            "hr_decision": decision,
            "hr_approved": approved,
            "hr_approved_date": datetime.now(),
            "hr_remarks": remarks,
            "completed_date": datetime.now(),
        }

        if hr_user_id:
            update_vals["hr_approved_by"] = hr_user_id

        if approved:
            update_vals["workflow_status"] = "approved"
            update_vals["state"] = "approved"
        else:
            update_vals["workflow_status"] = "rejected"
            update_vals["state"] = "refused"
            update_vals["rejection_reason"] = "hr_rejected"
            update_vals["rejection_details"] = remarks or "Rejected by HR"

        self.write(update_vals)
        self.clear_approval_token()

        return True

    # ============================================
    # FRAUD DETECTION METHODS
    # ============================================

    def set_fraud_detection_result(self, fraud_data):
        """
        Update expense with fraud detection results
        Called by backend after fraud detection pipeline runs

        Args:
            fraud_data: Dict containing:
                - document_hash: MD5 hash
                - perceptual_hash: pHash
                - fraud_score: 0.0-1.0
                - status: pending/clean/suspicious/fraudulent
                - details: Dict with per-layer results
                - anomaly_confidence: 0.0-1.0
                - clip_embedding: List[float] - 512-dim CLIP embedding
                - florence_analysis: str - Florence-2 analysis text
                - duplicate_of_id: ID of duplicate expense (if any)
        """
        self.ensure_one()

        update_vals = {
            "document_hash": fraud_data.get("document_hash"),
            "perceptual_hash": fraud_data.get("perceptual_hash"),
            "fraud_score": fraud_data.get("fraud_score", 0.0),
            "fraud_detection_status": fraud_data.get("status", "pending"),
            "fraud_detection_details": json.dumps(fraud_data.get("details", {})),
            "anomaly_confidence": fraud_data.get("anomaly_confidence", 0.0),
            "ai_verification_date": datetime.now(),
        }

        # Add CLIP embedding (store as JSON string)
        if fraud_data.get("clip_embedding"):
            update_vals["clip_embedding"] = json.dumps(fraud_data.get("clip_embedding"))

        # Add Florence-2 analysis
        if fraud_data.get("florence_analysis"):
            update_vals["florence_analysis"] = fraud_data.get("florence_analysis")

        if fraud_data.get("duplicate_of_id"):
            update_vals["duplicate_of_expense_id"] = fraud_data.get("duplicate_of_id")

        self.write(update_vals)

        return True

    # ============================================
    # HELPER METHODS FOR API
    # ============================================

    def get_expense_summary(self):
        """
        Get a summary dict of the expense for API responses
        """
        self.ensure_one()

        # Get attachment info if exists
        attachments = self.env["ir.attachment"].search(
            [
                ("res_model", "=", "hr.expense"),
                ("res_id", "=", self.id),
            ]
        )

        attachment_data = []
        for att in attachments:
            attachment_data.append(
                {
                    "id": att.id,
                    "name": att.name,
                    "mimetype": att.mimetype,
                    "file_size": att.file_size,
                }
            )

        return {
            "id": self.id,
            "name": self.name,
            "employee_id": self.employee_id.id,
            "employee_name": self.employee_id.name,
            "expense_category": self.expense_category,
            "vendor_name": self.vendor_name,
            "expense_date": self.expense_date.isoformat()
            if self.expense_date
            else None,
            "description": self.description,
            "total_amount": self.total_amount,
            "currency": self.currency_id.name if self.currency_id else "PKR",
            "workflow_status": self.workflow_status,
            "fraud_detection_status": self.fraud_detection_status,
            "fraud_score": self.fraud_score,
            "hr_escalated": self.hr_escalated,
            "manager_decision": self.manager_decision,
            "hr_decision": self.hr_decision,
            "submitted_date": self.submitted_date.isoformat()
            if self.submitted_date
            else None,
            "completed_date": self.completed_date.isoformat()
            if self.completed_date
            else None,
            "days_pending": self.days_pending,
            "attachments": attachment_data,
            "manager_remarks": self.manager_remarks,
            "hr_remarks": self.hr_remarks,
            "rejection_reason": self.rejection_reason,
            "rejection_details": self.rejection_details,
        }

    @api.model
    def get_pending_manager_approval(self, manager_id=None):
        """Get expenses pending manager approval"""
        domain = [("workflow_status", "=", "pending_manager")]
        if manager_id:
            employees = self.env["hr.employee"].search(
                [("parent_id.user_id", "=", manager_id)]
            )
            domain.append(("employee_id", "in", employees.ids))

        return self.search(domain)

    @api.model
    def get_pending_hr_approval(self):
        """Get expenses pending HR approval (escalated)"""
        return self.search(
            [
                ("workflow_status", "=", "pending_hr"),
                ("hr_escalated", "=", True),
            ]
        )

    @api.model
    def get_employee_expenses(self, employee_id, status=None, limit=50):
        """Get expenses for a specific employee"""
        domain = [("employee_id", "=", employee_id)]
        if status:
            domain.append(("workflow_status", "=", status))

        return self.search(domain, limit=limit, order="create_date desc")

    @api.model
    def get_expense_by_token(self, token):
        """Find expense by approval token"""
        expense = self.search([("approval_token", "=", token)], limit=1)
        if not expense:
            raise ValidationError("Invalid or expired approval link")
        return expense
