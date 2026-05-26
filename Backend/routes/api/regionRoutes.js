const express = require('express');
const isAuth = require('../../middleware/authentication');
const hasRole = require('../../middleware/authorization');
const { getRegion, createRegion, getDBRegions} = require('../../controllers/api/regionController');

const router = express.Router();

router.post('/create', isAuth, hasRole('ADMIN', 'BOSS'), createRegion);
router.get('/get/g', getDBRegions)

router.get('/static', getRegion)
router.get('/static/:area', getRegion)

module.exports = router;