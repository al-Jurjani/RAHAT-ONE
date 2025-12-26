import os
import random
import xmlrpc.client
from datetime import datetime, timedelta

from dotenv import load_dotenv

# Odoo Connection Settings
ODOO_URL = "http://localhost:8069"
ODOO_DB = "rahatone_db"
load_dotenv()
ODOO_USERNAME = os.environ.get("ODOO_USERNAME", "")
ODOO_PASSWORD = os.environ.get("ODOO_PASSWORD", "")


def connect_odoo():
    common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
    if not uid:
        raise Exception("Authentication failed! Check your credentials.")
    models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")
    print(f"Connected to Odoo as user ID: {uid}")
    return uid, models


def create_departments(uid, models):
    """Create company departments"""
    departments = [
        "Human Resources",
        "Finance & Accounting",
        "IT Department",
        "Sales & Marketing",
        "Operations",
        "Customer Service",
        "Supply Chain & Logistics",
    ]

    dept_ids = {}
    print("\nCreating departments...")

    for dept_name in departments:
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
            print(f"   ✓ Created {dept_name}")

    return dept_ids


def create_job_positions(uid, models, dept_ids):
    """Create hierarchical job positions for each department"""

    positions_by_dept = {
        "Human Resources": [
            ("HR Manager", "senior"),
            ("HR Officer", "mid"),
            ("HR Assistant", "junior"),
            ("Recruitment Specialist", "mid"),
            ("Training Coordinator", "junior"),
        ],
        "Finance & Accounting": [
            ("Finance Manager", "senior"),
            ("Senior Accountant", "mid"),
            ("Accountant", "mid"),
            ("Accounts Assistant", "junior"),
            ("Finance Analyst", "mid"),
        ],
        "IT Department": [
            ("IT Manager", "senior"),
            ("Senior Developer", "mid"),
            ("Software Developer", "mid"),
            ("Junior Developer", "junior"),
            ("DevOps Engineer", "mid"),
            ("IT Support Specialist", "junior"),
            ("System Administrator", "mid"),
        ],
        "Sales & Marketing": [
            ("Sales Manager", "senior"),
            ("Marketing Manager", "senior"),
            ("Senior Sales Executive", "mid"),
            ("Sales Executive", "mid"),
            ("Sales Associate", "junior"),
            ("Marketing Coordinator", "junior"),
            ("Digital Marketing Specialist", "mid"),
        ],
        "Operations": [
            ("Operations Manager", "senior"),
            ("Operations Supervisor", "mid"),
            ("Operations Officer", "mid"),
            ("Operations Assistant", "junior"),
        ],
        "Customer Service": [
            ("Customer Service Manager", "senior"),
            ("Senior Customer Service Rep", "mid"),
            ("Customer Service Representative", "mid"),
            ("Customer Service Associate", "junior"),
        ],
        "Supply Chain & Logistics": [
            ("Supply Chain Manager", "senior"),
            ("Logistics Coordinator", "mid"),
            ("Procurement Officer", "mid"),
            ("Warehouse Supervisor", "mid"),
            ("Logistics Assistant", "junior"),
        ],
    }

    job_ids = {}
    print("\nCreating job positions...")

    for dept_name, positions in positions_by_dept.items():
        if dept_name not in dept_ids:
            continue

        dept_id = dept_ids[dept_name]
        print(f"\n   {dept_name}:")

        for position_name, level in positions:
            existing = models.execute_kw(
                ODOO_DB,
                uid,
                ODOO_PASSWORD,
                "hr.job",
                "search",
                [[["name", "=", position_name], ["department_id", "=", dept_id]]],
            )

            if existing:
                job_ids[position_name] = existing[0]
                print(f"      ↳ {position_name} ({level})")
            else:
                job_id = models.execute_kw(
                    ODOO_DB,
                    uid,
                    ODOO_PASSWORD,
                    "hr.job",
                    "create",
                    [
                        {
                            "name": position_name,
                            "department_id": dept_id,
                            "no_of_recruitment": 1 if level == "junior" else 0,
                        }
                    ],
                )
                job_ids[position_name] = job_id
                print(f"      ✓ {position_name} ({level})")

    print(f"\nTotal: {len(job_ids)} job positions created")
    return job_ids


def create_employees(uid, models, dept_ids, job_ids):
    """Create mock employees with realistic data"""

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
        "Hamza",
        "Zara",
        "Imran",
        "Sadia",
        "Tariq",
        "Nida",
        "Faisal",
        "Aliya",
        "Arslan",
        "Huma",
        "Saad",
        "Mehreen",
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
        "Raza",
        "Haider",
        "Shahid",
        "Aziz",
    ]

    print("\nCreating employees...")
    employee_ids = []

    # Create 30 employees
    for i in range(30):
        first_name = random.choice(first_names)
        last_name = random.choice(last_names)
        full_name = f"{first_name} {last_name}"

        # Generate email
        email_name = f"{first_name.lower()}.{last_name.lower()}{random.randint(1, 99)}"
        work_email = f"{email_name}@outfitters.com.pk"

        # Random department and matching job
        dept_name = random.choice(list(dept_ids.keys()))
        dept_id = dept_ids[dept_name]

        # Get jobs for this department
        dept_jobs = [
            (job_name, job_id)
            for job_name, job_id in job_ids.items()
            if dept_name.split()[0] in job_name
            or dept_name == "IT Department"
            and "IT" in job_name
        ]

        if dept_jobs:
            job_name, job_id = random.choice(dept_jobs)
        else:
            # Fallback to any job in that department
            job_id = False
            # job_name = "General Position"

        # Create employee
        employee_data = {
            "name": full_name,
            "work_email": work_email,
            "department_id": dept_id,
            "job_id": job_id if job_id else False,
            "work_phone": f"+92-300-{random.randint(1000000, 9999999)}",
            "mobile_phone": f"+92-333-{random.randint(1000000, 9999999)}",
        }

        employee_id = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD, "hr.employee", "create", [employee_data]
        )

        employee_ids.append(employee_id)

        if (i + 1) % 10 == 0:
            print(f"   Created {i + 1} employees...")

    print(f"   ✓ Total: {len(employee_ids)} employees created")
    return employee_ids


def create_expense_products(uid, models):
    """Create expense categories"""
    expense_categories = [
        ("Medical Expense - Consultation", 5000),
        ("Medical Expense - Laboratory", 3000),
        ("Medical Expense - Pharmacy", 2000),
        ("Medical Expense - Hospitalization", 50000),
        ("Travel Expense - Domestic Flight", 15000),
        ("Travel Expense - Hotel Accommodation", 8000),
        ("Travel Expense - Local Transport", 2000),
        ("Fuel Expense - Petrol", 4000),
        ("Fuel Expense - CNG", 2500),
        ("Office Supplies", 1500),
        ("Client Entertainment", 5000),
    ]

    print("\nCreating expense categories...")
    product_ids = {}

    for category_name, default_amount in expense_categories:
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
            print(f"   ↳ {category_name}")
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
            print(f"   ✓ {category_name}")

    return product_ids


def create_expenses(uid, models, employee_ids, product_ids):
    """Create mock expense claims with variety"""
    print("\nCreating expense claims...")
    expense_ids = []

    vendors = {
        "Medical": [
            "Aga Khan Hospital",
            "Ziauddin Hospital",
            "Liaquat National",
            "Chughtai Lab",
            "IDC Lab",
            "Shifa International",
        ],
        "Travel": [
            "PIA",
            "Air Blue",
            "Serena Hotel",
            "Pearl Continental",
            "Movenpick",
            "Careem",
            "Uber",
        ],
        "Fuel": ["Shell", "PSO", "Total Parco", "Attock Petroleum"],
        "Office": ["Metro Cash & Carry", "Makro", "Staples"],
        "Entertainment": ["Okra", "Xanders", "Cosa Nostra", "The Pantry"],
    }

    states = ["draft", "reported", "approved", "done"]

    for i in range(50):  # Create 50 expense claims
        employee_id = random.choice(employee_ids)
        category = random.choice(list(product_ids.keys()))
        product_id = product_ids[category]

        # Determine vendor based on category
        if "Medical" in category:
            vendor = random.choice(vendors["Medical"])
        elif "Travel" in category:
            vendor = random.choice(vendors["Travel"])
        elif "Fuel" in category:
            vendor = random.choice(vendors["Fuel"])
        elif "Office" in category:
            vendor = random.choice(vendors["Office"])
        else:
            vendor = random.choice(vendors["Entertainment"])

        # Random amount (base price ± 40%)
        base_price = models.execute_kw(
            ODOO_DB,
            uid,
            ODOO_PASSWORD,
            "product.product",
            "read",
            [product_id, ["list_price"]],
        )[0]["list_price"]

        amount = base_price * random.uniform(0.6, 1.4)

        # Random date in last 90 days
        date = datetime.now() - timedelta(days=random.randint(1, 90))

        # Random state (weighted towards recent states)
        state = random.choices(states, weights=[2, 3, 3, 2])[0]

        expense_data = {
            "name": f"{category} - {vendor}",
            "employee_id": employee_id,
            "product_id": product_id,
            "total_amount": round(amount, 2),
            "quantity": 1,
            "date": date.strftime("%Y-%m-%d"),
            "description": f"Business expense for {category.lower()}",
            "state": state,
        }

        expense_id = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD, "hr.expense", "create", [expense_data]
        )

        expense_ids.append(expense_id)

        if (i + 1) % 10 == 0:
            print(f"   Created {i + 1} expenses...")

    print(f"   ✓ Total: {len(expense_ids)} expenses created")
    return expense_ids


def create_leave_types(uid, models):
    """Create leave types"""
    leave_types = [
        ("Annual Leave", 20),
        ("Sick Leave", 10),
        ("Emergency Leave", 5),
        ("Casual Leave", 15),
        ("Maternity Leave", 90),
        ("Paternity Leave", 14),
    ]

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
            models.execute_kw(
                ODOO_DB,
                uid,
                ODOO_PASSWORD,
                "hr.leave.type",
                "write",
                [[leave_type_id], {"requires_allocation": "no"}],
            )
            print(f"   ↳ {leave_name}")
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
                        "requires_allocation": "no",
                    }
                ],
            )
            leave_type_ids[leave_name] = leave_type_id
            print(f"   ✓ {leave_name}")

    return leave_type_ids


def _transition_leave_state(uid, models, leave_id):
    """Transition leave request to a random state"""
    state_choice = random.random()

    if state_choice < 0.3:
        # 30% stay in draft
        pass
    elif state_choice < 0.6:
        # 30% move to confirmed (employee submitted)
        models.execute_kw(
            ODOO_DB,
            uid,
            ODOO_PASSWORD,
            "hr.leave",
            "action_confirm",
            [[leave_id]],
        )
    elif state_choice < 0.85:
        # 25% move to validated (approved)
        models.execute_kw(
            ODOO_DB,
            uid,
            ODOO_PASSWORD,
            "hr.leave",
            "action_confirm",
            [[leave_id]],
        )
        models.execute_kw(
            ODOO_DB,
            uid,
            ODOO_PASSWORD,
            "hr.leave",
            "action_approve",
            [[leave_id]],
        )
    else:
        # 15% move to refused (rejected)
        models.execute_kw(
            ODOO_DB,
            uid,
            ODOO_PASSWORD,
            "hr.leave",
            "action_confirm",
            [[leave_id]],
        )
        models.execute_kw(
            ODOO_DB,
            uid,
            ODOO_PASSWORD,
            "hr.leave",
            "action_refuse",
            [[leave_id]],
        )


def _get_leave_duration(leave_type):
    """Determine leave duration based on type"""
    if "Maternity" in leave_type:
        return random.randint(60, 90)
    elif "Paternity" in leave_type:
        return random.randint(7, 14)
    elif "Emergency" in leave_type:
        return random.randint(1, 3)
    else:
        return random.randint(1, 7)


def _get_leave_start_date():
    """Generate leave start date (mix of past and future)"""
    if random.random() < 0.6:
        # 60% future dates (upcoming leaves)
        return datetime.now() + timedelta(days=random.randint(1, 90))
    else:
        # 40% past dates (historical leaves)
        return datetime.now() - timedelta(days=random.randint(1, 60))


def create_leave_requests(uid, models, employee_ids, leave_type_ids):
    """Create mock leave requests with variety"""
    print("\nCreating leave requests...")
    leave_ids = []

    for i in range(40):  # Create 40 leave requests
        employee_id = random.choice(employee_ids)
        leave_type = random.choice(list(leave_type_ids.keys()))
        leave_type_id = leave_type_ids[leave_type]

        duration = _get_leave_duration(leave_type)
        start_date = _get_leave_start_date()
        end_date = start_date + timedelta(days=duration - 1)

        # Create leave in draft state (always start here)
        leave_data = {
            "name": f"{leave_type} - {duration} day(s)",
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

        # Transition to different states (randomly)
        try:
            _transition_leave_state(uid, models, leave_id)
        except Exception as e:
            # If state transition fails, leave it in draft
            print(f"      ⚠️  Leave {leave_id} stayed in draft: {str(e)[:50]}")

        if (i + 1) % 10 == 0:
            print(f"   Created {i + 1} leave requests...")

    print(f"   ✓ Total: {len(leave_ids)} leave requests created")
    return leave_ids


if __name__ == "__main__":
    print("=" * 60)
    print("RAHAT-ONE Mock Data Population (Complete)")
    print("=" * 60)

    try:
        uid, models = connect_odoo()

        # Create organizational structure
        dept_ids = create_departments(uid, models)
        job_ids = create_job_positions(uid, models, dept_ids)
        employee_ids = create_employees(uid, models, dept_ids, job_ids)

        # Create expense and leave data
        product_ids = create_expense_products(uid, models)
        expense_ids = create_expenses(uid, models, employee_ids, product_ids)

        leave_type_ids = create_leave_types(uid, models)
        leave_ids = create_leave_requests(uid, models, employee_ids, leave_type_ids)

        print("\n" + "=" * 60)
        print("✅ Mock data population completed successfully!")
        print(f"Summary:")
        print(f"   • {len(dept_ids)} departments")
        print(f"   • {len(job_ids)} job positions")
        print(f"   • {len(employee_ids)} employees")
        print(f"   • {len(product_ids)} expense categories")
        print(f"   • {len(expense_ids)} expense claims")
        print(f"   • {len(leave_type_ids)} leave types")
        print(f"   • {len(leave_ids)} leave requests")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback

        traceback.print_exc()
