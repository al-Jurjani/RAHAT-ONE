const odooAdapter = require('../adapters/odooAdapter');
const { respondError } = require('../utils/responseHandler');
const powerAutomateService = require('../services/powerAutomateService');

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

      const keywords = ['manager', 'lead', 'head', 'coordinator', 'analyst'];

      const [deptEmployees, ...keywordMatches] = await Promise.all([
        odooAdapter.execute('hr.employee', 'search_read', [
          [
            ['department_id', '=', departmentId],
            ['active', '=', true]
          ],
          ['id', 'name', 'job_title', 'image_128']
        ]),
        ...keywords.map((kw) => odooAdapter.execute('hr.employee', 'search_read', [
          [
            ['active', '=', true],
            ['job_title', 'ilike', kw]
          ],
          ['id', 'name', 'job_title', 'image_128']
        ]))
      ]);

      const merged = [
        ...(deptEmployees || []),
        ...keywordMatches.flat()
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

      const payload = {
        departmentId,
        departmentName: departmentName || '',
        managerId,
        managerName: managerName || '',
        triggeredBy: req.user?.name || req.user?.email || 'HR',
        triggeredByRole: req.user?.role || 'hr',
        requestedAt: new Date().toISOString()
      };

      const triggered = await powerAutomateService.triggerDepartmentManagerCascade(payload);
      if (!triggered) {
        return respondError(res, 'Failed to trigger department manager assignment workflow', 502);
      }

      return res.status(202).json({
        success: true,
        message: 'Department manager assignment accepted and handed off to workflow.',
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
