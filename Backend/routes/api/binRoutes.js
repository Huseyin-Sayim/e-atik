const express = require('express');
const { getBins, createBin, updateBin, deleteBin } = require("../../controllers/api/binController");

const router = express.Router();

router.get('/', getBins);
router.post('/create', createBin);
router.put('/:id', updateBin);
router.delete('/:id', deleteBin);

module.exports = router;