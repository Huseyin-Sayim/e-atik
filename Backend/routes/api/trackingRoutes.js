const express = require('express');
const isAuth = require('../../middleware/authentication');
const hasRole = require('../../middleware/authorization');
const { getEmployeeLocations } = require('../../controllers/api/trackingController');

const router = express.Router();

router.get('/employees', isAuth, hasRole('ADMIN'), getEmployeeLocations);

module.exports = router;
