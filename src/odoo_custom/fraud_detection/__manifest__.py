# -*- coding: utf-8 -*-
{
    "name": "RAHAT-ONE Fraud Detection",
    "version": "1.0",
    "category": "Human Resources",
    "summary": "Adds fraud detection fields to HR Expenses for RAHAT-ONE FYP",
    "description": """
        This module extends the hr.expense model with custom fields for:
        - Document hash (MD5)
        - Perceptual hash
        - Fraud score
        - Verification status
        - AI detection metadata
    """,
    "author": "Zuhair Farhan - IBA FYP CS-26",
    "depends": ["hr_expense"],
    "data": [],
    "installable": True,
    "application": False,
    "auto_install": False,
}
