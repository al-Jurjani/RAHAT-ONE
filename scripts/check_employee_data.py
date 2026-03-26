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

print("Checking employee 518 details...")

employee = models.execute_kw(
    db,
    uid,
    password,
    "hr.employee",
    "read",
    [[518], ["id", "name", "work_email", "parent_id", "department_id"]],
)

print("\nEmployee 518 full data:")
print(employee[0])
