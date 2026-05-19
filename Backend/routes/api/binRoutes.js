const express = require('express');
const { getBins, createBin, updateBin, deleteBin, seedDefaultBins } = require("../../controllers/api/binController");

const router = express.Router();

router.get('/', getBins);
router.post('/create', createBin);
router.post('/seed', seedDefaultBins);
router.put('/:id', updateBin);
router.delete('/:id', deleteBin);

module.exports = router;