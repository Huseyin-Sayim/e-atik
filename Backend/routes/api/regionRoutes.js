const express = require('express');
const { getRegion } = require('../../controllers/api/regionController');

const router = express.Router();

router.get('/', getRegion)

module.exports = router;