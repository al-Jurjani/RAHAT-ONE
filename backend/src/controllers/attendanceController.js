const odooAdapter = require('../adapters/odooAdapter');
const { respondSuccess, respondError } = require('../utils/responseHandler');

function toInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toFloat(value) {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getPKTTime() {
  const now = new Date();
  const pktOffset = 5 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + pktOffset * 60000);
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(lat1 * Math.PI / 180)
    * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function decimalHourToMinutes(decimalHour) {
  return Math.round(Number(decimalHour) * 60);
}

function minutesSinceMidnight(dateObj) {
  return dateObj.getHours() * 60 + dateObj.getMinutes();
}

function jsDayToMondayFirst(jsDay) {
  return (jsDay + 6) % 7;
}

function pktDateRange(dateInput) {
  const base = dateInput ? new Date(dateInput) : getPKTTime();
  const pkt = new Date(base.getTime() + (5 * 60 - base.getTimezoneOffset()) * 60000);

  const start = new Date(pkt);
  start.setHours(0, 0, 0, 0);

  const end = new Date(pkt);
  end.setHours(23, 59, 59, 999);

  return {
    startUtc: new Date(start.getTime() - 5 * 60 * 60000),
    endUtc: new Date(end.getTime() - 5 * 60 * 60000)
  };
}

class AttendanceController {
  async checkIn(req, res) {
    try {
      const { employeeId, latitude, longitude, timestamp } = req.body;

      const employeeIdInt = toInt(employeeId);
      const lat = toFloat(latitude);
      const lon = toFloat(longitude);

      if (!employeeIdInt || lat === null || lon === null) {
        return respondError(res, 'employeeId, latitude, and longitude are required', 400);
      }

      if (req.user?.role !== 'hr' && req.user?.employee_id !== employeeIdInt) {
        return respondError(res, 'Forbidden', 403);
      }

      const employees = await odooAdapter.execute('hr.employee', 'search_read', [[
        ['id', '=', employeeIdInt]
      ], ['id', 'name', 'branch_id', 'shift_id']]);

      const employee = employees[0];
      if (!employee) {
        return respondError(res, 'Employee not found', 404);
      }

      if (!employee.branch_id || !Array.isArray(employee.branch_id) || !employee.branch_id[0]) {
        return res.status(400).json({
          success: false,
          error: 'NO_BRANCH',
          message: 'You have no branch assigned. Contact HR.'
        });
      }

      const branchId = employee.branch_id[0];
      const branches = await odooAdapter.execute('rahat.branch', 'search_read', [[
        ['id', '=', branchId]
      ], ['id', 'latitude', 'longitude', 'radius_meters', 'name']]);

      const branch = branches[0];
      if (!branch) {
        return respondError(res, 'Assigned branch not found', 404);
      }

      const distance = haversineDistance(lat, lon, Number(branch.latitude), Number(branch.longitude));
      const distanceRounded = Math.round(distance);
      const allowedRadius = Number(branch.radius_meters || 200);

      const checkInTime = timestamp ? new Date(timestamp) : new Date();
      if (Number.isNaN(checkInTime.getTime())) {
        return respondError(res, 'Invalid timestamp format', 400);
      }

      let status = 'present';
      let rejectionReason = false;
      let shiftId = employee.shift_id && Array.isArray(employee.shift_id) ? employee.shift_id[0] : false;

      if (distance > allowedRadius) {
        status = 'rejected';
        rejectionReason = `Location outside branch radius (${distanceRounded}m from branch, limit ${allowedRadius}m)`;

        const rejectedAttendanceId = await odooAdapter.execute('rahat.attendance', 'create', [{
          employee_id: employeeIdInt,
          branch_id: branchId,
          shift_id: shiftId || false,
          check_in: checkInTime.toISOString().slice(0, 19).replace('T', ' '),
          check_in_latitude: lat,
          check_in_longitude: lon,
          distance_from_branch: distance,
          status,
          rejection_reason: rejectionReason
        }]);

        return res.status(400).json({
          success: false,
          error: 'LOCATION_MISMATCH',
          message: `You are ${distanceRounded}m away from your branch. Check-in requires being within ${allowedRadius}m.`,
          distance: distanceRounded,
          allowed: allowedRadius,
          attendanceId: rejectedAttendanceId
        });
      }

      if (shiftId) {
        const shifts = await odooAdapter.execute('rahat.shift', 'search_read', [[
          ['id', '=', shiftId]
        ], ['id', 'start_time', 'end_time', 'grace_minutes', 'days_of_week']]);

        const shift = shifts[0];
        if (shift) {
          const nowPkt = getPKTTime();
          const currentMinutes = minutesSinceMidnight(nowPkt);
          const startMinutes = decimalHourToMinutes(shift.start_time);
          const endMinutes = decimalHourToMinutes(shift.end_time);
          const graceEndMinutes = startMinutes + Number(shift.grace_minutes || 15);

          const currentDay = jsDayToMondayFirst(nowPkt.getDay());
          const allowedDays = String(shift.days_of_week || '')
            .split(',')
            .map((item) => Number.parseInt(item.trim(), 10))
            .filter((item) => !Number.isNaN(item));

          const inDay = allowedDays.includes(currentDay);
          const inWindow = currentMinutes >= startMinutes && currentMinutes <= endMinutes;

          if (!inDay || !inWindow) {
            status = 'rejected';
            rejectionReason = 'Check-in outside shift window';
          } else if (currentMinutes > startMinutes && currentMinutes <= graceEndMinutes) {
            status = 'late';
          } else {
            status = 'present';
          }
        }
      }

      const attendancePayload = {
        employee_id: employeeIdInt,
        branch_id: branchId,
        shift_id: shiftId || false,
        check_in: checkInTime.toISOString().slice(0, 19).replace('T', ' '),
        check_in_latitude: lat,
        check_in_longitude: lon,
        distance_from_branch: distance,
        status,
        rejection_reason: rejectionReason || false
      };

      let odooAttendanceId = false;
      if (status === 'present' || status === 'late') {
        odooAttendanceId = await odooAdapter.execute('hr.attendance', 'create', [{
          employee_id: employeeIdInt,
          check_in: checkInTime.toISOString().slice(0, 19).replace('T', ' ')
        }]);
        attendancePayload.odoo_attendance_id = odooAttendanceId;
      }

      const attendanceId = await odooAdapter.execute('rahat.attendance', 'create', [attendancePayload]);

      const message = status === 'present'
        ? 'Checked in successfully'
        : status === 'late'
          ? 'Checked in late'
          : (rejectionReason || 'Check-in rejected');

      return res.status(200).json({
        success: true,
        status,
        message,
        attendanceId,
        distanceFromBranch: distanceRounded,
        odooAttendanceId: odooAttendanceId || null
      });
    } catch (error) {
      console.error('checkIn error:', error);
      return respondError(res, 'Failed to process check-in', 500);
    }
  }

  async checkOut(req, res) {
    try {
      const { employeeId, latitude, longitude, timestamp } = req.body;

      const employeeIdInt = toInt(employeeId);
      const lat = toFloat(latitude);
      const lon = toFloat(longitude);

      if (!employeeIdInt || lat === null || lon === null) {
        return respondError(res, 'employeeId, latitude, and longitude are required', 400);
      }

      if (req.user?.role !== 'hr' && req.user?.employee_id !== employeeIdInt) {
        return respondError(res, 'Forbidden', 403);
      }

      const activeCheckins = await odooAdapter.execute('rahat.attendance', 'search_read', [[
        ['employee_id', '=', employeeIdInt],
        ['check_out', '=', false],
        ['status', 'in', ['present', 'late']]
      ], ['id', 'check_in', 'branch_id', 'odoo_attendance_id', 'status'], 0, 1, 'check_in desc']);

      if (!activeCheckins || activeCheckins.length === 0) {
        return res.status(400).json({ success: false, error: 'NO_ACTIVE_CHECKIN', message: 'No active check-in found' });
      }

      const active = activeCheckins[0];
      const branchId = Array.isArray(active.branch_id) ? active.branch_id[0] : active.branch_id;

      const branches = await odooAdapter.execute('rahat.branch', 'search_read', [[
        ['id', '=', branchId]
      ], ['id', 'latitude', 'longitude', 'radius_meters']]);
      const branch = branches[0];

      const distance = branch
        ? haversineDistance(lat, lon, Number(branch.latitude), Number(branch.longitude))
        : 0;

      const checkoutTime = timestamp ? new Date(timestamp) : new Date();
      if (Number.isNaN(checkoutTime.getTime())) {
        return respondError(res, 'Invalid timestamp format', 400);
      }

      const checkoutValue = checkoutTime.toISOString().slice(0, 19).replace('T', ' ');

      await odooAdapter.execute('rahat.attendance', 'write', [[active.id], {
        check_out: checkoutValue,
        check_out_latitude: lat,
        check_out_longitude: lon,
        distance_from_branch: distance
      }]);

      const linkedOdooAttendanceId = Array.isArray(active.odoo_attendance_id)
        ? active.odoo_attendance_id[0]
        : active.odoo_attendance_id;

      if (linkedOdooAttendanceId) {
        await odooAdapter.execute('hr.attendance', 'write', [[linkedOdooAttendanceId], {
          check_out: checkoutValue
        }]);
      }

      const workedHours = (checkoutTime.getTime() - new Date(active.check_in).getTime()) / (1000 * 60 * 60);

      return res.status(200).json({
        success: true,
        workedHours: Number(workedHours.toFixed(2))
      });
    } catch (error) {
      console.error('checkOut error:', error);
      return respondError(res, 'Failed to process check-out', 500);
    }
  }

  async getTodayAttendance(req, res) {
    try {
      const employeeId = toInt(req.params.employeeId);
      if (!employeeId) {
        return respondError(res, 'Invalid employee ID', 400);
      }

      if (req.user?.role !== 'hr' && req.user?.employee_id !== employeeId) {
        return respondError(res, 'Forbidden', 403);
      }

      const { startUtc, endUtc } = pktDateRange();

      const records = await odooAdapter.execute('rahat.attendance', 'search_read', [[
        ['employee_id', '=', employeeId],
        ['check_in', '>=', startUtc.toISOString().slice(0, 19).replace('T', ' ')],
        ['check_in', '<=', endUtc.toISOString().slice(0, 19).replace('T', ' ')]
      ], ['id', 'check_in', 'check_out', 'status', 'branch_id', 'distance_from_branch', 'worked_hours', 'rejection_reason'], 0, 1, 'check_in desc']);

      const latest = records && records.length ? records[0] : null;
      return respondSuccess(res, latest, 'Today attendance fetched');
    } catch (error) {
      console.error('getTodayAttendance error:', error);
      return respondError(res, 'Failed to fetch today attendance', 500);
    }
  }

  async getAttendanceHistory(req, res) {
    try {
      const employeeId = toInt(req.params.employeeId);
      if (!employeeId) {
        return respondError(res, 'Invalid employee ID', 400);
      }

      if (req.user?.role !== 'hr' && req.user?.employee_id !== employeeId) {
        return respondError(res, 'Forbidden', 403);
      }

      const limit = toInt(req.query.limit) || 30;
      const offset = toInt(req.query.offset) || 0;

      const records = await odooAdapter.execute('rahat.attendance', 'search_read', [[
        ['employee_id', '=', employeeId]
      ], ['id', 'check_in', 'check_out', 'status', 'branch_id', 'shift_id', 'distance_from_branch', 'worked_hours', 'rejection_reason'], offset, limit, 'check_in desc']);

      return respondSuccess(res, {
        records,
        limit,
        offset
      }, 'Attendance history fetched');
    } catch (error) {
      console.error('getAttendanceHistory error:', error);
      return respondError(res, 'Failed to fetch attendance history', 500);
    }
  }

  async getHrSummary(req, res) {
    try {
      if (req.user?.role !== 'hr') {
        return respondError(res, 'Forbidden', 403);
      }

      const branchId = toInt(req.query.branchId);
      const inputDate = req.query.date;

      const { startUtc, endUtc } = pktDateRange(inputDate);

      const domain = [
        ['check_in', '>=', startUtc.toISOString().slice(0, 19).replace('T', ' ')],
        ['check_in', '<=', endUtc.toISOString().slice(0, 19).replace('T', ' ')]
      ];

      if (branchId) {
        domain.push(['branch_id', '=', branchId]);
      }

      const records = await odooAdapter.execute('rahat.attendance', 'search_read', [
        domain,
        ['id', 'employee_id', 'branch_id', 'status', 'check_in', 'check_out', 'worked_hours'],
        0,
        500,
        'check_in desc'
      ]);

      const summary = records.map((record) => ({
        id: record.id,
        employeeId: Array.isArray(record.employee_id) ? record.employee_id[0] : null,
        employeeName: Array.isArray(record.employee_id) ? record.employee_id[1] : null,
        branchId: Array.isArray(record.branch_id) ? record.branch_id[0] : null,
        branchName: Array.isArray(record.branch_id) ? record.branch_id[1] : null,
        status: record.status,
        check_in: record.check_in,
        check_out: record.check_out,
        worked_hours: record.worked_hours
      }));

      return respondSuccess(res, summary, 'HR attendance summary fetched');
    } catch (error) {
      console.error('getHrSummary error:', error);
      return respondError(res, 'Failed to fetch HR attendance summary', 500);
    }
  }
}

module.exports = new AttendanceController();
