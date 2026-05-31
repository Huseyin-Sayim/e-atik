const express = require('express');
const { getMyWallet } = require('../../controllers/api/walletController');
const isAuth = require('../../middleware/authentication');

const router = express.Router();

router.get('/me', isAuth, getMyWallet);

module.exports = router;
