import os
import xmlrpc.client

from dotenv import load_dotenv

load_dotenv()

# -----------------------------
# CONFIGURATION
# -----------------------------
url = os.environ.get("ODOO_URL", "http://localhost:8069")
db = os.environ.get("ODOO_DB", "odoo_db")
admin_username = os.environ.get("ODOO_USERNAME", "admin")
admin_password = os.environ.get("ODOO_PASSWORD", "admin_password")

bot_name = "Rahat-One RPA Bot"
bot_login = "rahat.rpa.bot@outfitters.com"
bot_password = os.environ.get("BOT_PASSWORD", "enter_password_here")

# -----------------------------
# CONNECT TO ODOO
# -----------------------------
common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common")
uid = common.authenticate(db, admin_username, admin_password, {})

if not uid:
    raise Exception("Authentication failed")

models = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object")

# -----------------------------
# 1️⃣ Get Administrator Group ID (base.group_system)
# -----------------------------
ref = models.execute_kw(
    db,
    uid,
    admin_password,
    "ir.model.data",
    "search_read",
    [[("module", "=", "base"), ("name", "=", "group_system")]],
    {"fields": ["res_id"], "limit": 1},
)

if not ref:
    raise Exception("Administrator group not found")

admin_group_id = ref[0]["res_id"]

# -----------------------------
# 2️⃣ Create Bot User
# -----------------------------
bot_user_id = models.execute_kw(
    db,
    uid,
    admin_password,
    "res.users",
    "create",
    [
        {
            "name": bot_name,
            "login": bot_login,
            "password": bot_password,
            "groups_id": [(6, 0, [admin_group_id])],
        }
    ],
)

print("\n=================================")
print("BOT CREATED SUCCESSFULLY")
print("ID:    ", bot_user_id)
print("Login: ", bot_login)
print("Password:", bot_password)
print("=================================\n")

# -----------------------------
# 3️⃣ Generate API Key (commented out)
# Cannot be done via XML-RPC — Odoo's _generate method is blocked by RPC
# and the key is stored as an HMAC hash, so direct insert won't work.
# Generate the API key manually in Odoo: Settings > Users > bot user > API Keys tab
# -----------------------------

# api_key = secrets.token_hex(32)
# models.execute_kw(
#     db, uid, admin_password,
#     'res.users.apikeys', 'create',
#     [{
#         'name': 'PowerAutomate Integration',
#         'user_id': bot_user_id,
#         'key': api_key
#     }]
# )
