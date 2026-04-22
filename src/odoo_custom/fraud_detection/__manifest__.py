# -*- coding: utf-8 -*-
{
    "name": "RAHAT-ONE Fraud Detection & Expense Workflow V2",
    "version": "2.1",
    "category": "Human Resources",
    "summary": "V2 status-based fraud detection and multi-level approval workflow",
    "description": """
        This module extends the hr.expense model with:

        Fraud Detection (V2):
        - Document hash (MD5) for exact duplicate detection
        - Perceptual hash for visual similarity detection
        - 3-layer status-based fraud verification (clean/suspicious/fraudulent)
        - AI detection metadata

        Expense Workflow:
        - Expense categories (Medical, Petrol, Travel, Other)
        - Multi-level approval (Manager + HR escalation)
        - Compatible with expense V2 n8n orchestration flows
        - Policy validation tracking
        - Secure token-based email approvals
        - Complete workflow state management
    """,
    "author": "RAHAT-ONE Team - IBA FYP CS-26",
    "depends": ["base", "hr", "hr_expense"],
    "data": [
        "security/ir.model.access.csv",
        "views/hr_expense_views.xml",
    ],
    "installable": True,
    "application": False,
    "auto_install": False,
}
