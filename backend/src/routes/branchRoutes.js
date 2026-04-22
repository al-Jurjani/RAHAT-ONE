const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken, requireRole('hr'));

router.get('/', branchController.getBranches.bind(branchController));
router.post('/', branchController.createBranch.bind(branchController));
router.patch('/:branchId', branchController.updateBranch.bind(branchController));
router.delete('/:branchId', branchController.deleteBranch.bind(branchController));

router.post('/:branchId/set-manager', branchController.setManager.bind(branchController));
router.get('/:branchId/shifts', branchController.getBranchShifts.bind(branchController));
router.post('/:branchId/shifts', branchController.createShift.bind(branchController));
router.patch('/shifts/:shiftId', branchController.updateShift.bind(branchController));
router.delete('/shifts/:shiftId', branchController.deleteShift.bind(branchController));

module.exports = router;
