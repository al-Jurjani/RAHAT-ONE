import os
import random
import xmlrpc.client
from datetime import datetime, timedelta

from dotenv import load_dotenv

# Odoo Connection Settings
ODOO_URL = "http://localhost:8069"
ODOO_DB = "rahatone_db"
load_dotenv()
ODOO_USERNAME = "s.kumar.27149@khi.iba.edu.pk"
ODOO_PASSWORD = "Tbijm@321"


# Authenticate and return Odoo API objects
def connect_odoo():
    common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

    if not uid:
        raise Exception("Authentication failed! Check your credentials.")

    models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")
    print(f"Connected to Odoo as user ID: {uid}")
    return uid, models


# Create company departments
def create_departments(uid, models):
    departments = [
        "Human Resources",
        "Finance",
        "IT Department",
        "Sales",
        "Marketing",
        "Operations",
        "Customer Service",
    ]

    dept_ids = {}
    print("\nCreating departments...")

    for dept_name in departments:
        # Check if already exists
        existing = models.execute_kw(
            ODOO_DB,
            uid,
            ODOO_PASSWORD,
            "hr.department",
            "search",
            [[["name", "=", dept_name]]],
        )

        if existing:
            dept_ids[dept_name] = existing[0]
            print(f"   ↳ {dept_name} (already exists)")
        else:
            dept_id = models.execute_kw(
                ODOO_DB,
                uid,
                ODOO_PASSWORD,
                "hr.department",
                "create",
                [{"name": dept_name}],
            )
            dept_ids[dept_name] = dept_id
            print(f"Created {dept_name}")

    return dept_ids


# Creating mock employees
def create_employees(uid, models, dept_ids):
    first_names = [
        "Ahmed",
        "Fatima",
        "Ali",
        "Ayesha",
        "Hassan",
        "Zainab",
        "Omar",
        "Maryam",
        "Ibrahim",
        "Hira",
        "Usman",
        "Sana",
        "Bilal",
        "Noor",
        "Farhan",
        "Amna",
        "Kamran",
        "Rabia",
    ]

    last_names = [
        "Khan",
        "Ahmed",
        "Ali",
        "Malik",
        "Sheikh",
        "Rashid",
        "Hussain",
        "Mahmood",
        "Siddiqui",
        "Butt",
        "Akhtar",
        "Jamil",
    ]

    positions = ["Manager", "Executive", "Officer", "Assistant Manager"]

    print("\nCreating employees...")
    employee_ids = []

    for i in range(50):  # Create 50 employees
        first_name = random.choice(first_names)
        last_name = random.choice(last_names)
        full_name = f"{first_name} {last_name}"

        # Generate email
        email = f"{first_name.lower()}.{last_name.lower()}{random.randint(1, 999)}@outfitters.com.pk"

        # Random department
        dept_name = random.choice(list(dept_ids.keys()))
        dept_id = dept_ids[dept_name]

        # Random position
        position = random.choice(positions)

        # Create employee
        employee_data = {
            "name": full_name,
            "work_email": email,
            "department_id": dept_id,
            "job_title": position,
            "work_phone": f"+92-300-{random.randint(1000000, 9999999)}",
        }

        employee_id = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD, "hr.employee", "create", [employee_data]
        )

        employee_ids.append(employee_id)

        if (i + 1) % 10 == 0:
            print(f"Created {i + 1} employees...")

    print(f"Total: {len(employee_ids)} employees created")
    return employee_ids


# creating expense categories
def create_expense_products(uid, models):
    expense_categories = [
        ("Medical Expense", 10000),
        ("Travel Expense", 5000),
        ("Fuel Expense", 4000),
    ]

    print("Creating expense categories...")
    product_ids = {}

    for category_name, default_amount in expense_categories:
        # Check if product exists
        existing = models.execute_kw(
            ODOO_DB,
            uid,
            ODOO_PASSWORD,
            "product.product",
            "search",
            [[["name", "=", category_name]]],
        )

        if existing:
            product_ids[category_name] = existing[0]
            print(f"   ↳ {category_name} (already exists)")
        else:
            product_id = models.execute_kw(
                ODOO_DB,
                uid,
                ODOO_PASSWORD,
                "product.product",
                "create",
                [
                    {
                        "name": category_name,
                        "can_be_expensed": True,
                        "list_price": default_amount,
                        "type": "service",
                    }
                ],
            )
            product_ids[category_name] = product_id
            print(f"   ✓ Created {category_name}")

    return product_ids


# creating sample expenses
def create_expenses(uid, models, employee_ids, product_ids):
    print("\nCreating expense claims...")
    expense_ids = []

    vendors = ["Aga Khan", "Ziauddin", "Shell Petrol", "PSO", "PIA", "FlyJinnah"]

    for i in range(30):  # Create 30 expense claims
        employee_id = random.choice(employee_ids)
        category = random.choice(list(product_ids.keys()))
        product_id = product_ids[category]

        # Random amount (base price ± 30%)
        base_price = models.execute_kw(
            ODOO_DB,
            uid,
            ODOO_PASSWORD,
            "product.product",
            "read",
            [product_id, ["list_price"]],
        )[0]["list_price"]

        amount = base_price * random.uniform(0.7, 1.3)

        # Random date in last 60 days
        date = datetime.now() - timedelta(days=random.randint(1, 60))

        expense_data = {
            "name": f"{category} - {random.choice(vendors)}",
            "employee_id": employee_id,
            "product_id": product_id,
            "total_amount": round(amount, 2),
            "quantity": 1,
            "date": date.strftime("%Y-%m-%d"),
            "description": f"Expense claim for {category.lower()}",
        }

        expense_id = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD, "hr.expense", "create", [expense_data]
        )

        expense_ids.append(expense_id)

        if (i + 1) % 10 == 0:
            print(f"Created {i + 1} expenses...")

    print(f"Total: {len(expense_ids)} expenses created")
    return expense_ids


# creating leave types
def create_leave_types(uid, models):
    leave_types = [("Travel Leave", 20), ("Sick Leave", 10), ("Emergency Leave", 5)]

    print("\nCreating leave types...")
    leave_type_ids = {}

    for leave_name, allocation in leave_types:
        existing = models.execute_kw(
            ODOO_DB,
            uid,
            ODOO_PASSWORD,
            "hr.leave.type",
            "search",
            [[["name", "=", leave_name]]],
        )

        if existing:
            leave_type_id = existing[0]
            leave_type_ids[leave_name] = leave_type_id

            # Update existing leave type
            models.execute_kw(
                ODOO_DB,
                uid,
                ODOO_PASSWORD,
                "hr.leave.type",
                "write",
                [[leave_type_id], {"requires_allocation": "no"}],  # <-- FIXED
            )

            print(
                f"   ↳ {leave_name} (already exists — updated requires allocation to no)"
            )
        else:
            leave_type_id = models.execute_kw(
                ODOO_DB,
                uid,
                ODOO_PASSWORD,
                "hr.leave.type",
                "create",
                [
                    {
                        "name": leave_name,
                        # 'requires_allocation': 'yes',
                        "requires_allocation": "no",  # need to make yes later for real case scenarios - will require an addition function
                        # 'allocation_type': 'fixed',
                    }
                ],
            )
            leave_type_ids[leave_name] = leave_type_id
            print(f"Created {leave_name}")

    return leave_type_ids


# creating mock leave requests
def create_leave_requests(uid, models, employee_ids, leave_type_ids):
    print("\nCreating leave requests...")
    leave_ids = []

    for i in range(20):  # Create 20 leave requests
        employee_id = random.choice(employee_ids)
        leave_type = random.choice(list(leave_type_ids.keys()))
        leave_type_id = leave_type_ids[leave_type]

        # Random date range in next 90 days
        start_date = datetime.now() + timedelta(days=random.randint(1, 60))
        duration = random.randint(1, 5)  # 1-5 days
        end_date = start_date + timedelta(days=duration - 1)

        leave_data = {
            "name": f"{leave_type} Request",
            "holiday_status_id": leave_type_id,
            "employee_id": employee_id,
            "request_date_from": start_date.strftime("%Y-%m-%d"),
            "request_date_to": end_date.strftime("%Y-%m-%d"),
            "number_of_days": duration,
        }

        leave_id = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD, "hr.leave", "create", [leave_data]
        )

        leave_ids.append(leave_id)

        if (i + 1) % 10 == 0:
            print(f"Created {i + 1} leave requests...")

    print(f"Total: {len(leave_ids)} leave requests created")
    return leave_ids


# main script
if __name__ == "__main__":
    print("=" * 60)
    print("RAHAT-ONE Mock Data Population")
    print("=" * 60)

    try:
        uid, models = connect_odoo()

        # Create organizational structure
        dept_ids = create_departments(uid, models)
        employee_ids = create_employees(uid, models, dept_ids)

        # Create expense data
        product_ids = create_expense_products(uid, models)
        expense_ids = create_expenses(uid, models, employee_ids, product_ids)

        # Create leave data
        leave_type_ids = create_leave_types(uid, models)
        leave_ids = create_leave_requests(uid, models, employee_ids, leave_type_ids)

        print("\n" + "=" * 60)
        print("Mock data population completed successfully!")
        print(f"Summary:")
        print(f"      • {len(dept_ids)} departments")
        print(f"      • {len(employee_ids)} employees")
        print(f"      • {len(expense_ids)} expense claims")
        print(f"      • {len(leave_ids)} leave requests")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback

        traceback.print_exc()
