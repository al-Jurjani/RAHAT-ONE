# -*- coding: utf-8 -*-
from odoo import fields, models  # type: ignore


class HrExpenseInherit(models.Model):
    _inherit = "hr.expense"

    # Fraud Detection Fields
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
        string="Fraud Score",
        help="Aggregated fraud confidence score (0.0 to 1.0)",
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
