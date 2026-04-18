const odooAdapter = require('../adapters/odooAdapter');
const { respondError } = require('../utils/responseHandler');

function toInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeManager(value) {
  if (!value || !Array.isArray(value)) {
    return null;
  }

  return {
    id: value[0],
    name: value[1]
  };
}

class DepartmentController {
  async getDepartments(req, res) {
    try {
      const [departments, employees] = await Promise.all([
        odooAdapter.execute('hr.department', 'search_read', [
          [],
          ['id', 'name', 'manager_id', 'parent_id', 'active', 'complete_name']
        ]),
        odooAdapter.execute('hr.employee', 'search_read', [
          [['active', '=', true]],
          ['id', 'department_id']
        ])
      ]);

      const counts = (employees || []).reduce((acc, employee) => {
        const departmentId = Array.isArray(employee.department_id)
          ? employee.department_id[0]
          : employee.department_id;

        if (!departmentId) {
          return acc;
        }

        acc[departmentId] = (acc[departmentId] || 0) + 1;
        return acc;
      }, {});

      const data = (departments || []).map((department) => ({
        id: department.id,
        name: department.name,
        manager_id: normalizeManager(department.manager_id),
        parent_id: department.parent_id,
        active: department.active,
        complete_name: department.complete_name,
        employee_count: counts[department.id] || 0
      }));

      return res.status(200).json(data);
    } catch (error) {
      console.error('getDepartments error:', error);
      return respondError(res, 'Failed to fetch departments', 500);
    }
  }

  async getDepartmentEmployees(req, res) {
    try {
      const departmentId = toInt(req.params.departmentId);
      if (!departmentId) {
        return respondError(res, 'Invalid department ID', 400);
      }

      const employees = await odooAdapter.execute('hr.employee', 'search_read', [
        [
          ['department_id', '=', departmentId],
          ['active', '=', true]
        ],
        ['id', 'name', 'job_title', 'parent_id', 'work_email', 'mobile_phone', 'image_128', 'branch_id', 'shift_id']
      ]);

      return res.status(200).json(employees || []);
    } catch (error) {
      console.error('getDepartmentEmployees error:', error);
      return respondError(res, 'Failed to fetch department employees', 500);
    }
  }

  async getDepartmentManagers(req, res) {
    try {
      const departmentId = toInt(req.params.departmentId);
      if (!departmentId) {
        return respondError(res, 'Invalid department ID', 400);
      }

      const [deptEmployees, managerTitleMatches, leadTitleMatches, headTitleMatches] = await Promise.all([
        odooAdapter.execute('hr.employee', 'search_read', [
          [
            ['department_id', '=', departmentId],
            ['active', '=', true]
          ],
          ['id', 'name', 'job_title', 'image_128']
        ]),
        odooAdapter.execute('hr.employee', 'search_read', [
          [
            ['active', '=', true],
            ['job_title', 'ilike', 'manager']
          ],
          ['id', 'name', 'job_title', 'image_128']
        ]),
        odooAdapter.execute('hr.employee', 'search_read', [
          [
            ['active', '=', true],
            ['job_title', 'ilike', 'lead']
          ],
          ['id', 'name', 'job_title', 'image_128']
        ]),
        odooAdapter.execute('hr.employee', 'search_read', [
          [
            ['active', '=', true],
            ['job_title', 'ilike', 'head']
          ],
          ['id', 'name', 'job_title', 'image_128']
        ])
      ]);

      const merged = [
        ...(deptEmployees || []),
        ...(managerTitleMatches || []),
        ...(leadTitleMatches || []),
        ...(headTitleMatches || [])
      ];
      const uniqueById = Array.from(new Map(merged.map((item) => [item.id, item])).values());

      return res.status(200).json(uniqueById);
    } catch (error) {
      console.error('getDepartmentManagers error:', error);
      return respondError(res, 'Failed to fetch department managers', 500);
    }
  }

  async assignDepartmentManager(req, res) {
    try {
      const departmentId = toInt(req.params.departmentId);
      const managerId = toInt(req.body.managerId);
      const managerName = req.body.managerName;
      const departmentName = req.body.departmentName;

      if (!departmentId) {
        return respondError(res, 'Invalid department ID', 400);
      }

      if (!managerId) {
        return respondError(res, 'managerId is required', 400);
      }

      await odooAdapter.execute('hr.department', 'write', [[departmentId], {
        manager_id: managerId
      }]);

      const webhookBase = process.env.N8N_WEBHOOK_BASE_URL;
      if (webhookBase) {
        fetch(`${webhookBase}/department-manager-cascade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            departmentId,
            departmentName: departmentName || '',
            managerId,
            managerName: managerName || '',
            triggeredBy: req.user?.name || 'HR'
          })
        }).catch(() => {});
      }

      return res.status(200).json({
        success: true,
        message: 'Manager assigned. Employee records are being updated automatically.',
        departmentId,
        managerId
      });
    } catch (error) {
      console.error('assignDepartmentManager error:', error);
      return respondError(res, 'Failed to assign department manager', 500);
    }
  }
}

module.exports = new DepartmentController();
