const express = require('express');
const isAuth = require('../../middleware/authentication');
const hasRole = require('../../middleware/authorization');
const {
  getRoutePlan,
  getRouteLeg,
  getRegionBins,
  getRegionAlerts,
  getRouteProgress,
  putRouteProgress,
} = require('../../controllers/api/employeeRouteController');

const router = express.Router();
const employeeOnly = [isAuth, hasRole('EMPLOYEE')];

router.get('/route-plan', ...employeeOnly, getRoutePlan);
router.get('/route-leg', ...employeeOnly, getRouteLeg);
router.get('/region-bins', ...employeeOnly, getRegionBins);
router.get('/region-alerts', ...employeeOnly, getRegionAlerts);
router.get('/route-progress', ...employeeOnly, getRouteProgress);
router.put('/route-progress', ...employeeOnly, putRouteProgress);

module.exports = router;
