import os
import xmlrpc.client
from dotenv import load_dotenv


# -----------------------------
# Odoo Connection Settings
# -----------------------------
ODOO_URL = "http://localhost:8069"
ODOO_DB = "rahatone_db"

load_dotenv(dotenv_path="../backend/.env")
ODOO_USERNAME = os.getenv("ODOO_USERNAME")
ODOO_PASSWORD = os.getenv("ODOO_PASSWORD")


# -----------------------------
# Connect to Odoo
# -----------------------------
def connect_odoo():
    common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
    if not uid:
        raise Exception("Odoo authentication failed")

    models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")
    print(f"Connected to Odoo (UID={uid})")
    return uid, models


# -----------------------------
# Departments
# -----------------------------
def create_departments(uid, models):
    departments = [
        "Human Resources",
        "Finance & Accounting",
        "IT & Systems",
        "Store Operations",
        "Supply Chain & Logistics",
    ]

    dept_ids = {}
    print("\nCreating departments...")

    for name in departments:
        existing = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            "hr.department", "search",
            [[["name", "=", name]]]
        )

        if existing:
            dept_ids[name] = existing[0]
            print(f" ↳ {name} (exists)")
        else:
            dept_ids[name] = models.execute_kw(
                ODOO_DB, uid, ODOO_PASSWORD,
                "hr.department", "create",
                [{"name": name}]
            )
            print(f" ✓ {name}")

    return dept_ids


# -----------------------------
# Job Positions
# -----------------------------
def create_job_positions(uid, models, dept_ids):
    positions = {
        "Human Resources": ["HR Manager", "HR Officer"],
        "Finance & Accounting": ["Finance Manager", "Accountant"],
        "IT & Systems": ["IT Manager", "ERP / RPA Analyst"],
        "Store Operations": ["Store Manager", "Sales Associate", "Cashier"],
        "Supply Chain & Logistics": ["Supply Chain Manager", "Warehouse Coordinator"],
    }

    job_ids = {}
    print("\nCreating job positions...")

    for dept, roles in positions.items():
        dept_id = dept_ids[dept]
        print(f"\n {dept}:")
        for role in roles:
            existing = models.execute_kw(
                ODOO_DB, uid, ODOO_PASSWORD,
                "hr.job", "search",
                [[["name", "=", role], ["department_id", "=", dept_id]]]
            )

            if existing:
                job_ids[role] = existing[0]
                print(f"   ↳ {role} (exists)")
            else:
                job_ids[role] = models.execute_kw(
                    ODOO_DB, uid, ODOO_PASSWORD,
                    "hr.job", "create",
                    [{
                        "name": role,
                        "department_id": dept_id,
                        "no_of_recruitment": 1,
                    }]
                )
                print(f"   ✓ {role}")

    return job_ids


# -----------------------------
# Employees + Users (1 per role)
# -----------------------------
def create_employees_and_users(uid, models, job_ids):
    print("\nCreating employees and users...")

    employees = [
        ("Ayesha Khan", "HR Manager"),
        ("Bilal Ahmed", "HR Officer"),
        ("Sara Malik", "Finance Manager"),
        ("Usman Raza", "Accountant"),
        ("Imran Siddiqui", "IT Manager"),
        ("Hassan Ali", "ERP / RPA Analyst"),
        ("Kamran Sheikh", "Store Manager"),
        ("Zara Noor", "Sales Associate"),
        ("Ali Haider", "Cashier"),
        ("Faisal Khan", "Supply Chain Manager"),
        ("Noman Akhtar", "Warehouse Coordinator"),
    ]

    for name, job in employees:
        email = f"{name.lower().replace(' ', '.')}@outfitters.com.pk"

        existing_user = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            "res.users", "search",
            [[["login", "=", email]]]
        )

        if existing_user:
            print(f" ↳ User already exists: {email}, skipping")
            continue

        user_id = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            "res.users", "create",
            [{
                "name": name,
                "login": email,
                "email": email,
            }]
        )

        models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            "hr.employee", "create",
            [{
                "name": name,
                "work_email": email,
                "user_id": user_id,
                "job_id": job_ids[job],
            }]
        )

        print(f" ✓ {name} ({job})")

    print(f"\nTotal employees/users created: {len(employees)}")


# -----------------------------
# Main
# -----------------------------
if __name__ == "__main__":
    print("=" * 60)
    print("RAHAT-ONE | Outfitters-Aligned Mock Data")
    print("=" * 60)

    uid, models = connect_odoo()
    dept_ids = create_departments(uid, models)
    job_ids = create_job_positions(uid, models, dept_ids)
    create_employees_and_users(uid, models, job_ids)

    print("\n✅ Mock data population completed successfully")
    print("=" * 60)
