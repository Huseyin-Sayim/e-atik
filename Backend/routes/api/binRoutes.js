const express = require('express');
const {getBins, createBin} = require("../../controllers/api/binController");

const router = express.Router();

router.get('/', getBins);
router.post('/create', createBin);


module.exports = router;