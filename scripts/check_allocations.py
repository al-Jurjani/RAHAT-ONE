#!/usr/bin/env python3
"""
Check allocations in Odoo for employees 513 and 518
"""

import os
import xmlrpc.client

from dotenv import load_dotenv

url = "http://localhost:8069"
db = "rahatone_db"
load_dotenv()
username = os.environ.get("ODOO_USERNAME", "")
password = os.environ.get("ODOO_PASSWORD", "")

# Authenticate
common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common")
uid = common.authenticate(db, username, password, {})

if not uid:
    print("❌ Authentication failed!")
    exit(1)

print(f"✅ Authenticated\n")

models = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object")

# Check employees
for emp_id in [513, 518]:
    print(f"{'='*60}")
    print(f"CHECKING EMPLOYEE ID: {emp_id}")
    print(f"{'='*60}\n")

    # Get employee info
    employees = models.execute_kw(
        db,
        uid,
        password,
        "hr.employee",
        "read",
        [[emp_id]],
        {"fields": ["id", "name", "work_email"]},
    )

    if employees:
        print(f"Employee: {employees[0]['name']} ({employees[0]['work_email']})\n")
    else:
        print(f"❌ Employee {emp_id} not found!\n")
        continue

    # Get ALL allocations for this employee (any state)
    print("--- ALL ALLOCATIONS (any state) ---")
    allocations = models.execute_kw(
        db,
        uid,
        password,
        "hr.leave.allocation",
        "search_read",
        [[["employee_id", "=", emp_id]]],
        {
            "fields": [
                "id",
                "employee_id",
                "holiday_status_id",
                "number_of_days",
                "state",
                "name",
            ]
        },
    )

    if allocations:
        for alloc in allocations:
            print(f"  Allocation ID: {alloc['id']}")
            print(f"    Employee: {alloc['employee_id']}")
            print(f"    Leave Type: {alloc['holiday_status_id']}")
            print(f"    Days: {alloc['number_of_days']}")
            print(f"    State: '{alloc['state']}'")
            print(f"    Name: {alloc['name']}")
            print()
    else:
        print(f"  ❌ NO allocations found for employee {emp_id}\n")

    # Get leaves
    print("--- ALL LEAVES (any state) ---")
    leaves = models.execute_kw(
        db,
        uid,
        password,
        "hr.leave",
        "search_read",
        [[["employee_id", "=", emp_id]]],
        {
            "fields": [
                "id",
                "employee_id",
                "holiday_status_id",
                "number_of_days",
                "state",
            ]
        },
    )

    if leaves:
        for leave in leaves:
            print(f"  Leave ID: {leave['id']}")
            print(f"    Employee: {leave['employee_id']}")
            print(f"    Leave Type: {leave['holiday_status_id']}")
            print(f"    Days: {leave['number_of_days']}")
            print(f"    State: '{leave['state']}'")
            print()
    else:
        print(f"  ❌ NO leaves found\n")

    print()
