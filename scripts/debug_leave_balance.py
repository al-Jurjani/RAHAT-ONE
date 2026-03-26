#!/usr/bin/env python3
"""
Debug leave balance for employee 513
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

employee_id = 513

# Check employee exists
employees = models.execute_kw(
    db,
    uid,
    password,
    "hr.employee",
    "read",
    [[employee_id]],
    {"fields": ["id", "name", "work_email"]},
)

if not employees:
    print(f"❌ Employee {employee_id} not found!")
    exit(1)

print(f"Employee Info:")
print(f"  ID: {employees[0]['id']}")
print(f"  Name: {employees[0]['name']}")
print(f"  Email: {employees[0]['work_email']}")

# Get Annual Leave type
leave_types = models.execute_kw(
    db,
    uid,
    password,
    "hr.leave.type",
    "search_read",
    [[["name", "=", "Annual Leave"]]],
    {"fields": ["id", "name"]},
)

if not leave_types:
    print("\n❌ Annual Leave type not found!")
    exit(1)

leave_type_id = leave_types[0]["id"]
print(f"\nAnnual Leave Type ID: {leave_type_id}")

# Check allocations
print(f"\n--- Checking Allocations ---")
allocations = models.execute_kw(
    db,
    uid,
    password,
    "hr.leave.allocation",
    "search_read",
    [[["employee_id", "=", employee_id], ["holiday_status_id", "=", leave_type_id]]],
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

if not allocations:
    print(f"❌ NO allocations found for employee {employee_id}")
    print(f"\nYou need to create an allocation in Odoo:")
    print(f"  Time Off → Allocations → Create")
    print(f"  Employee: Isbah Inam (ID: {employee_id})")
    print(f"  Leave Type: Annual Leave")
    print(f"  Days: 20")
    print(f"  Then click VALIDATE")
else:
    print(f"✅ Found {len(allocations)} allocation(s):")
    total_days = 0
    for alloc in allocations:
        print(f"\n  Allocation ID: {alloc['id']}")
        print(f"  Employee: {alloc['employee_id']}")
        print(f"  Leave Type: {alloc['holiday_status_id']}")
        print(f"  Days: {alloc['number_of_days']}")
        print(f"  State: {alloc['state']}")
        print(f"  Description: {alloc['name']}")

        if alloc["state"] == "validate":
            total_days += alloc["number_of_days"]

    print(f"\n📊 Total validated days: {total_days}")

# Check leaves (used days)
print(f"\n--- Checking Leaves (Used Days) ---")
leaves = models.execute_kw(
    db,
    uid,
    password,
    "hr.leave",
    "search_read",
    [
        [
            ["employee_id", "=", employee_id],
            ["holiday_status_id", "=", leave_type_id],
            ["state", "=", "validate"],
        ]
    ],
    {
        "fields": [
            "id",
            "number_of_days",
            "request_date_from",
            "request_date_to",
            "state",
        ]
    },
)

if not leaves:
    print(f"✅ No approved leaves found (0 days used)")
else:
    print(f"Found {len(leaves)} approved leave(s):")
    used_days = 0
    for leave in leaves:
        print(f"\n  Leave ID: {leave['id']}")
        print(f"  From: {leave['request_date_from']}")
        print(f"  To: {leave['request_date_to']}")
        print(f"  Days: {leave['number_of_days']}")
        used_days += leave["number_of_days"]

    print(f"\n📊 Total used days: {used_days}")

print(f"\n" + "=" * 50)
print(f"SUMMARY:")
print(f"  Employee ID: {employee_id}")
print(f"  Total Allocated: {total_days if allocations else 0}")
print(f"  Total Used: {sum(lev['number_of_days'] for lev in leaves) if leaves else 0}")
print(
    f"  Remaining: {total_days - sum(lev['number_of_days'] for lev in leaves) if (allocations and leaves) else total_days}"
)
print(f"=" * 50)
