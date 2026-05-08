const express = require('express');
const { getRegion, createRegion, getDBRegions} = require('../../controllers/api/regionController');

const router = express.Router();

router.post('/create', createRegion);
router.get('/get/g', getDBRegions)

router.get('/static', getRegion)
router.get('/static/:area', getRegion)

module.exports = router;