"""Branch, shift, and employee branch assignment models for RAHAT attendance."""

from odoo import api, fields, models


class RahatBranch(models.Model):
    """Defines a physical branch location used for geo-fenced attendance."""

    _name = "rahat.branch"
    _description = "Outfitters Branch Location"
    _rec_name = "name"

    name = fields.Char(string="Branch Name", required=True)
    address = fields.Text(string="Address")
    latitude = fields.Float(string="Latitude", digits=(10, 7), required=True)
    longitude = fields.Float(string="Longitude", digits=(10, 7), required=True)
    radius_meters = fields.Integer(string="Check-in Radius (meters)", default=200)
    active = fields.Boolean(default=True)
    shift_ids = fields.One2many("rahat.shift", "branch_id", string="Shifts")
    employee_count = fields.Integer(
        string="Employee Count",
        compute="_compute_employee_count",
    )

    @api.depends()
    def _compute_employee_count(self):
        """Count employees assigned to each branch."""
        employee_model = self.env["hr.employee"]
        for branch in self:
            branch.employee_count = employee_model.search_count(
                [
                    ("branch_id", "=", branch.id),
                ]
            )


class RahatShift(models.Model):
    """Defines working shifts that belong to a branch."""

    _name = "rahat.shift"
    _description = "Branch Shift Timing"

    branch_id = fields.Many2one("rahat.branch", required=True, ondelete="cascade")
    name = fields.Char(required=True)
    start_time = fields.Float(string="Start Time (24h)", required=True)
    end_time = fields.Float(string="End Time (24h)", required=True)
    grace_minutes = fields.Integer(string="Grace Period (minutes)", default=15)
    days_of_week = fields.Char(string="Working Days", default="0,1,2,3,4")


class HrEmployeeExtension(models.Model):
    """Adds branch and shift assignment fields to employees."""

    _inherit = "hr.employee"

    branch_id = fields.Many2one("rahat.branch", string="Assigned Branch")
    shift_id = fields.Many2one("rahat.shift", string="Assigned Shift")
