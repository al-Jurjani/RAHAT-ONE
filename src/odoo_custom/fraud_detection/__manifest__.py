# -*- coding: utf-8 -*-
{
    "name": "RAHAT-ONE Fraud Detection & Expense Workflow",
    "version": "2.0",
    "category": "Human Resources",
    "summary": "Fraud detection and multi-level approval workflow for HR Expenses",
    "description": """
        This module extends the hr.expense model with:

        Fraud Detection:
        - Document hash (MD5) for exact duplicate detection
        - Perceptual hash for visual similarity detection
        - Fraud score and verification status
        - AI detection metadata

        Expense Workflow:
        - Expense categories (Medical, Petrol, Travel, Other)
        - Multi-level approval (Manager + HR escalation)
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
