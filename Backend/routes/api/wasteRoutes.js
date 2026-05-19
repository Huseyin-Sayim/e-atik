const express = require('express');
const { createWasteRequest, getWasteRequests, updateWasteStatus } = require('../../controllers/api/wasteController');
const isAuth = require('../../middleware/authentication');

const router = express.Router();

// Evsel atık talebi oluştur
router.post('/', isAuth, createWasteRequest);

// Tüm evsel atık taleplerini listele
router.get('/', isAuth, getWasteRequests);

// Evsel atık talebi durumunu güncelle (Örn: ON_ROUTE, COLLECTED)
router.put('/:id/status', isAuth, updateWasteStatus);

module.exports = router;
