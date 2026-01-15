#!/usr/bin/env python3
import os
import xmlrpc.client

from dotenv import load_dotenv

url = "http://localhost:8069"
db = "rahatone_db"
load_dotenv()
username = os.environ.get("ODOO_USERNAME", "")
password = os.environ.get("ODOO_PASSWORD", "")

common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common")
uid = common.authenticate(db, username, password, {})
models = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object")

print("=" * 60)
print("CHECKING USER vs EMPLOYEE ID MISMATCH")
print("=" * 60)

# Get all users
users = models.execute_kw(
    db,
    uid,
    password,
    "res.users",
    "search_read",
    [[["is_rahatone_user", "=", True]]],
    {"fields": ["id", "name", "login", "employee_id"]},
)

for user in users:
    print(f"\nUser: {user['name']}")
    print(f"  User ID: {user['id']}")
    print(f"  Login: {user['login']}")
    print(f"  Linked Employee ID: {user['employee_id']}")

    if user["employee_id"]:
        emp_id = user["employee_id"][0]

        # Check allocations for this employee
        allocations = models.execute_kw(
            db,
            uid,
            password,
            "hr.leave.allocation",
            "search_read",
            [[["employee_id", "=", emp_id]]],
            {"fields": ["id", "holiday_status_id", "number_of_days", "state"]},
        )

        if allocations:
            print(f"  ✅ Has {len(allocations)} allocation(s):")
            for alloc in allocations:
                print(
                    f"     - {alloc['holiday_status_id'][1]}: {alloc['number_of_days']} days (state: {alloc['state']})"
                )
        else:
            print(f"  ❌ NO allocations found")
    else:
        print(f"  ⚠️  NOT linked to any employee!")

print("\n" + "=" * 60)
