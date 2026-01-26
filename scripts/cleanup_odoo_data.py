import os
import xmlrpc.client

from dotenv import load_dotenv

# Odoo Connection Settings
ODOO_URL = "http://localhost:8069"
ODOO_DB = "rahatone_db"
load_dotenv()
ODOO_USERNAME = os.environ.get("ODOO_USERNAME", "")
ODOO_PASSWORD = os.environ.get("ODOO_PASSWORD", "")


def connect_odoo():
    """Connect to Odoo and authenticate"""
    common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

    if not uid:
        raise Exception("Authentication failed! Check your credentials.")

    models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")
    print(f"✅ Connected to Odoo as user ID: {uid}")
    return uid, models


def delete_leave_requests(uid, models):
    """Delete all leave requests"""
    print("\n🗑️  Deleting leave requests...")
    leave_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD, "hr.leave", "search", [[]]
    )

    if leave_ids:
        models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD, "hr.leave", "unlink", [leave_ids]
        )
        print(f"   ✅ Deleted {len(leave_ids)} leave requests")
    else:
        print("   ℹ️  No leave requests to delete")


def delete_expenses(uid, models):
    """Delete all expense claims"""
    print("\n🗑️  Deleting expense claims...")
    expense_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD, "hr.expense", "search", [[]]
    )

    if expense_ids:
        models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD, "hr.expense", "unlink", [expense_ids]
        )
        print(f"   ✅ Deleted {len(expense_ids)} expense claims")
    else:
        print("   ℹ️  No expenses to delete")


def delete_employees(uid, models):
    """Delete all employees except admin"""
    print("\n🗑️  Deleting employees...")
    # Keep first 2 employees (usually admin/system users)
    employee_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD, "hr.employee", "search", [[["id", ">", 2]]]
    )

    if employee_ids:
        models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD, "hr.employee", "unlink", [employee_ids]
        )
        print(f"   ✅ Deleted {len(employee_ids)} employees")
    else:
        print("   ℹ️  No employees to delete")


def delete_job_positions(uid, models):
    """Delete all job positions"""
    print("\n🗑️  Deleting job positions...")
    job_ids = models.execute_kw(ODOO_DB, uid, ODOO_PASSWORD, "hr.job", "search", [[]])

    if job_ids:
        models.execute_kw(ODOO_DB, uid, ODOO_PASSWORD, "hr.job", "unlink", [job_ids])
        print(f"   ✅ Deleted {len(job_ids)} job positions")
    else:
        print("   ℹ️  No job positions to delete")


def delete_departments(uid, models):
    """Delete all departments"""
    print("\n🗑️  Deleting departments...")
    dept_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD, "hr.department", "search", [[]]
    )

    if dept_ids:
        models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD, "hr.department", "unlink", [dept_ids]
        )
        print(f"   ✅ Deleted {len(dept_ids)} departments")
    else:
        print("   ℹ️  No departments to delete")


def delete_expense_products(uid, models):
    """Delete expense products/categories"""
    print("\n🗑️  Deleting expense products...")

    expense_categories = ["Medical Expense", "Travel Expense", "Fuel Expense"]

    for category in expense_categories:
        product_ids = models.execute_kw(
            ODOO_DB,
            uid,
            ODOO_PASSWORD,
            "product.product",
            "search",
            [[["name", "=", category]]],
        )

        if product_ids:
            models.execute_kw(
                ODOO_DB, uid, ODOO_PASSWORD, "product.product", "unlink", [product_ids]
            )
            print(f"   ✅ Deleted {category}")


def delete_leave_types(uid, models):
    """Delete custom leave types (keep system defaults)"""
    print("\n🗑️  Deleting leave types...")

    leave_types = ["Travel Leave", "Sick Leave", "Emergency Leave"]

    for leave_type in leave_types:
        type_ids = models.execute_kw(
            ODOO_DB,
            uid,
            ODOO_PASSWORD,
            "hr.leave.type",
            "search",
            [[["name", "=", leave_type]]],
        )

        if type_ids:
            models.execute_kw(
                ODOO_DB, uid, ODOO_PASSWORD, "hr.leave.type", "unlink", [type_ids]
            )
            print(f"   ✅ Deleted {leave_type}")


if __name__ == "__main__":
    print("=" * 60)
    print("RAHAT-ONE Data Cleanup Script")
    print("=" * 60)
    print("\n⚠️  WARNING: This will delete all HR data!")
    print("   (Departments, Employees, Expenses, Leaves)")

    confirm = input("\n❓ Are you sure you want to proceed? (yes/no): ")

    if confirm.lower() != "yes":
        print("\n❌ Cleanup cancelled.")
        exit()

    try:
        uid, models = connect_odoo()

        # Delete in correct order (child records first)
        delete_leave_requests(uid, models)
        delete_expenses(uid, models)
        delete_employees(uid, models)
        delete_job_positions(uid, models)
        delete_departments(uid, models)
        delete_expense_products(uid, models)
        delete_leave_types(uid, models)

        print("\n" + "=" * 60)
        print("✅ Cleanup completed successfully!")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback

        traceback.print_exc()
