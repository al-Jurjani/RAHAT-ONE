# -*- coding: utf-8 -*-
{
    "name": "RAHAT-ONE Employee Onboarding Status",
    "version": "2.0",
    "category": "Human Resources",
    "summary": "Custom fields for n8n-automated onboarding with auto-approve support",
    "description": """
        Adds custom fields to hr.employee for:
        - AI verification status and scoring
        - HR manual verification
        - Onboarding state tracking
        - Rejection handling
        - n8n automation fields (employee_type, auto_approved, cnic_verified, manual_review_required)
        - Bank details for salary disbursement
        - Emergency contact information
    """,
    "author": "RAHAT-ONE Team",
    "depends": ["hr", "hr_expense"],
    "data": [],
    "installable": True,
    "application": False,
    "auto_install": False,
}
