const express = require('express');
const {getUsers, deleteUser, updateProfile, getUserProfile, scanQrCode, getUserTransactions} = require("../../controllers/api/userController");
const isAuth = require('../../middleware/authentication.js')
const hasRole = require('../../middleware/authorization.js')

const router = express.Router();

router.get('/', isAuth ,getUsers);
router.get('/me', isAuth, getUserProfile);
router.get('/transactions', isAuth, getUserTransactions);
router.get('/delete/:id', isAuth, hasRole('USER'), deleteUser)
router.put('/update-profile', updateProfile);
router.post('/scan-qr', isAuth, scanQrCode);

module.exports = router;