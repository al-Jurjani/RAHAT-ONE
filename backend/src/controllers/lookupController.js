const odooAdapter = require('../adapters/odooAdapter');
const { respondSuccess, respondError } = require('../utils/responseHandler');

// DEBUG: Check what we imported
console.log('respondSuccess:', typeof respondSuccess);
console.log('respondError:', typeof respondError);



/**
 * Get all departments
 */
async function getDepartments(req, res) {
  try {
    const departments = await odooAdapter.getDepartments();
    respondSuccess(res, departments);
  } catch (error) {
    console.error('❌ Get departments error:', error);
    respondError(res, error.message, 500);
  }
}

/**
 * Get job positions by department
 */
async function getJobPositions(req, res) {
  try {
    const { departmentId } = req.query;

    let positions;
    if (departmentId) {
      positions = await odooAdapter.getJobPositionsByDepartment(parseInt(departmentId));
    } else {
      positions = await odooAdapter.getAllJobPositions();
    }

    respondSuccess(res, positions);
  } catch (error) {
    console.error('❌ Get job positions error:', error);
    respondError(res, error.message, 500);
  }
}

module.exports = {
  getDepartments,
  getJobPositions
};
