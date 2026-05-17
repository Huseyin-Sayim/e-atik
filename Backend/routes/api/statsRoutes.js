const express = require('express');
const isAuth = require('../../middleware/authentication');
const { getRecyclingStats } = require('../../controllers/api/statsController');

const router = express.Router();

router.get('/recycling', isAuth, getRecyclingStats);

module.exports = router;
