"""Custom GPS attendance model for RAHAT branch and shift tracking."""

from odoo import api, fields, models


class RahatAttendance(models.Model):
    """Stores GPS-based attendance events and linkage to Odoo attendance."""

    _name = "rahat.attendance"
    _description = "RAHAT GPS Attendance Record"
    _inherit = ["mail.thread"]
    _order = "check_in desc"

    employee_id = fields.Many2one(
        "hr.employee", required=True, ondelete="cascade", tracking=True
    )
    branch_id = fields.Many2one("rahat.branch", string="Branch", required=True)
    shift_id = fields.Many2one("rahat.shift", string="Shift")
    check_in = fields.Datetime(string="Check In", required=True, tracking=True)
    check_out = fields.Datetime(string="Check Out", tracking=True)
    check_in_latitude = fields.Float(string="Check-in Latitude", digits=(10, 7))
    check_in_longitude = fields.Float(string="Check-in Longitude", digits=(10, 7))
    check_out_latitude = fields.Float(string="Check-out Latitude", digits=(10, 7))
    check_out_longitude = fields.Float(string="Check-out Longitude", digits=(10, 7))
    distance_from_branch = fields.Float(string="Distance from Branch (m)")
    status = fields.Selection(
        [
            ("present", "Present"),
            ("late", "Late"),
            ("rejected", "Rejected — Location Mismatch"),
            ("manual", "Manual Entry by HR"),
        ],
        string="Status",
        required=True,
        default="present",
        tracking=True,
    )
    rejection_reason = fields.Char(string="Rejection Reason")
    worked_hours = fields.Float(
        string="Worked Hours",
        compute="_compute_worked_hours",
        store=True,
    )
    odoo_attendance_id = fields.Many2one(
        "hr.attendance", string="Linked Odoo Attendance"
    )

    @api.depends("check_in", "check_out")
    def _compute_worked_hours(self):
        """Compute worked hours from check-in/check-out datetimes."""
        for record in self:
            if record.check_in and record.check_out:
                delta = record.check_out - record.check_in
                record.worked_hours = delta.total_seconds() / 3600.0
            else:
                record.worked_hours = 0.0
