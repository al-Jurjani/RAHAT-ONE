import bcrypt
from odoo import fields, models

# from odoo import api


class ResUsersCustom(models.Model):
    _inherit = "res.users"

    # Custom fields
    rahatone_role = fields.Selection(
        [
            ("hr", "HR Staff"),
            ("manager", "Manager"),
            ("employee", "Employee"),
        ],
        string="RAHAT-ONE Role",
        default="employee",
    )

    employee_id = fields.Many2one(
        "hr.employee", string="Linked Employee", help="Link user to employee record"
    )

    is_rahatone_user = fields.Boolean(
        string="RAHAT-ONE User",
        default=True,
        help="Flag to identify users created through RAHAT-ONE system",
    )

    password_hash = fields.Char(
        string="Password Hash",
        help="Bcrypt hashed password for RAHAT-ONE authentication",
    )

    last_login_date = fields.Datetime(string="Last Login", readonly=True)

    account_status = fields.Selection(
        [
            ("active", "Active"),
            ("inactive", "Inactive"),
            ("locked", "Locked"),
        ],
        string="Account Status",
        default="active",
    )

    failed_login_attempts = fields.Integer(string="Failed Login Attempts", default=0)

    # Methods
    def set_rahatone_password(self, password):
        """Hash and store password using bcrypt"""
        self.ensure_one()
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        self.password_hash = hashed.decode("utf-8")
        return True

    def verify_rahatone_password(self, password):
        """Verify password against stored hash"""
        self.ensure_one()
        if not self.password_hash:
            return False
        return bcrypt.checkpw(
            password.encode("utf-8"), self.password_hash.encode("utf-8")
        )

    def increment_failed_login(self):
        """Increment failed login counter and lock if threshold exceeded"""
        self.ensure_one()
        self.failed_login_attempts += 1

        # Lock account after 5 failed attempts
        if self.failed_login_attempts >= 5:
            self.account_status = "locked"
            return True
        return False

    def reset_failed_login(self):
        """Reset failed login counter on successful login"""
        self.ensure_one()
        self.failed_login_attempts = 0
        self.last_login_date = fields.Datetime.now()

    def create_rahatone_user(
        self, name, email, password, role="employee", employee_id=None
    ):
        """Create new RAHAT-ONE user"""
        # Check if user already exists
        existing = self.search([("login", "=", email)])
        if existing:
            raise ValueError(f"User with email {email} already exists")

        # Create user
        user = self.create(
            {
                "name": name,
                "login": email,
                "email": email,
                "rahatone_role": role,
                "is_rahatone_user": True,
                "employee_id": employee_id,
                "account_status": "active",
            }
        )

        # Set password
        user.set_rahatone_password(password)

        return user
