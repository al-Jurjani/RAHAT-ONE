#!/usr/bin/env python3
"""
Script to set up leave types in Odoo 17 for RAHAT-ONE
Uses Odoo's standard hr_holidays module (no custom module needed)

Run: python3 setup_leave_types.py
"""

import os
import sys
import xmlrpc.client

from dotenv import load_dotenv

# Odoo connection details
url = "http://localhost:8069"
db = "rahatone_db"
# username = "admin"
# password = "admin"
load_dotenv()
username = os.environ.get("ODOO_USERNAME", "")
password = os.environ.get("ODOO_PASSWORD", "")

print("🚀 RAHAT-ONE Leave Types Setup (Odoo 17)")
print("=" * 50)

try:
    # Authenticate
    print(f"\n📡 Connecting to Odoo at {url}...")
    common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common")
    uid = common.authenticate(db, username, password, {})

    if not uid:
        print("❌ Authentication failed!")
        print("   Check your credentials in the script.")
        sys.exit(1)

    print(f"✅ Authenticated as user ID: {uid}")

    # Get models proxy
    models = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object")

    # Define leave types - SIMPLIFIED for Odoo 17
    leave_types = [
        {
            "name": "Annual Leave",
            "requires_allocation": "yes",  # Changed from allocation_type
            "time_type": "leave",
            "request_unit": "day",
            "color": 10,  # Green
            "active": True,
        },
        {
            "name": "Sick Leave",
            "requires_allocation": "yes",
            "time_type": "leave",
            "request_unit": "day",
            "color": 3,  # Orange
            "active": True,
        },
        {
            "name": "Emergency Leave",
            "requires_allocation": "yes",
            "time_type": "leave",
            "request_unit": "day",
            "color": 1,  # Red
            "active": True,
        },
        {
            "name": "Unpaid Leave",
            "requires_allocation": "no",  # No allocation needed
            "time_type": "leave",
            "request_unit": "day",
            "color": 0,  # Gray
            "active": True,
        },
    ]

    print("\n📝 Creating leave types...")
    print("-" * 50)

    created_count = 0
    existing_count = 0

    for leave_type in leave_types:
        # Check if exists
        existing = models.execute_kw(
            db,
            uid,
            password,
            "hr.leave.type",
            "search",
            [[["name", "=", leave_type["name"]]]],
        )

        if existing:
            print(f"⚠️  '{leave_type['name']}' already exists (ID: {existing[0]})")
            existing_count += 1
        else:
            # Create leave type
            leave_type_id = models.execute_kw(
                db, uid, password, "hr.leave.type", "create", [leave_type]
            )
            print(f"✅ Created '{leave_type['name']}' (ID: {leave_type_id})")
            created_count += 1

    print("-" * 50)
    print(f"📊 Summary: {created_count} created, {existing_count} already existed")

    # Show all leave types
    print("\n📋 All Leave Types in System:")
    print("-" * 50)
    all_types = models.execute_kw(
        db,
        uid,
        password,
        "hr.leave.type",
        "search_read",
        [[]],
        {"fields": ["name", "requires_allocation", "color"]},
    )

    for lt in all_types:
        allocation = (
            "✅ Requires Allocation"
            if lt.get("requires_allocation") == "yes"
            else "❌ No Allocation"
        )
        print(f"  • {lt['name']} (ID: {lt['id']})")
        print(f"    {allocation}, Color: {lt['color']}")

    print("\n" + "=" * 50)
    print("✅ Leave types setup complete!")
    print("\n📌 Next Steps:")
    print("   1. Go to Odoo: Time Off → Configuration → Time Off Types")
    print("   2. Verify the leave types are created")
    print("   3. Go to: Time Off → Allocations → All Allocations")
    print("   4. Click 'Create' to allocate leaves to employees")
    print("   5. Run: node test_leave_types.js (to verify)")
    print("=" * 50)

except Exception as e:
    print(f"\n❌ Error: {e}")
    print("\n🔧 Troubleshooting:")
    print("   - Is Odoo running? (docker ps)")
    print("   - Is the database name correct? (rahatone)")
    print("   - Are credentials correct? (admin/admin)")
    sys.exit(1)
