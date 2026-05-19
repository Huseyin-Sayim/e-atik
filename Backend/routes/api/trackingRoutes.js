const express = require('express');
const isAuth = require('../../middleware/authentication');
const hasRole = require('../../middleware/authorization');
const {
  getEmployeeLocations,
  getEmployeeLocationDetail,
  postEmployeeLocation,
} = require('../../controllers/api/trackingController');

const router = express.Router();
const supervisorRoles = hasRole('ADMIN', 'BOSS');
const employeeOnly = hasRole('EMPLOYEE');

router.get('/employees', isAuth, supervisorRoles, getEmployeeLocations);
router.get('/employees/:userId', isAuth, supervisorRoles, getEmployeeLocationDetail);
router.post('/location', isAuth, employeeOnly, postEmployeeLocation);

module.exports = router;
