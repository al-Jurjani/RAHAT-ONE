from odoo import api, fields, models  # type: ignore


class HrEmployeeOnboarding(models.Model):
    _inherit = "hr.employee"

    # Onboarding Status
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
        ],
        string="Onboarding Status",
        default="not_started",
        readonly=True,
    )

    onboarding_initiated_date = fields.Datetime(
        string="Onboarding Initiated",
        help="Date when onboarding process started",
        readonly=True,
    )

    onboarding_completed_date = fields.Datetime(
        string="Onboarding Completed",
        help="Date when employee was fully activated",
        readonly=True,
    )

    # Document Verification
    documents_verified = fields.Boolean(
        string="Documents Verified", default=False, readonly=True
    )

    document_verification_notes = fields.Text(
        string="Verification Notes",
        help="Notes from document verification process",
        readonly=True,
    )

    # System Provisioning
    email_provisioned = fields.Boolean(
        string="Email Account Created", default=False, readonly=True
    )

    system_access_provisioned = fields.Boolean(
        string="System Access Granted", default=False, readonly=True
    )

    orientation_completed = fields.Boolean(
        string="Orientation Completed", default=False, readonly=True
    )

    # Workflow Tracking
    current_onboarding_task = fields.Char(
        string="Current Task", help="Current step in onboarding workflow", readonly=True
    )

    onboarding_progress_percentage = fields.Float(
        string="Onboarding Progress", compute="_compute_onboarding_progress", store=True
    )

    @api.depends(
        "onboarding_status",
        "documents_verified",
        "email_provisioned",
        "system_access_provisioned",
        "orientation_completed",
    )
    def _compute_onboarding_progress(self):
        """Calculate onboarding completion percentage"""
        for record in self:
            if record.onboarding_status == "not_started":
                record.onboarding_progress_percentage = 0.0
            elif record.onboarding_status == "activated":
                record.onboarding_progress_percentage = 100.0
            else:
                # Calculate based on completed steps
                total_steps = 5
                completed = sum(
                    [
                        1
                        if record.onboarding_status
                        in [
                            "initiated",
                            "documents_submitted",
                            "verification_pending",
                            "verified",
                            "provisioning",
                        ]
                        else 0,
                        1 if record.documents_verified else 0,
                        1 if record.email_provisioned else 0,
                        1 if record.system_access_provisioned else 0,
                        1 if record.orientation_completed else 0,
                    ]
                )
                record.onboarding_progress_percentage = (completed / total_steps) * 100
