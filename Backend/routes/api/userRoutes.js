const express = require('express');
const {getUsers, register, login, updateProfileType, forgotPassword, verifyResetCode, resetPassword} = require("../../controllers/api/userController");

const router = express.Router();

router.get('/', getUsers);
router.post('/register', register);
router.post('/login', login);
router.put('/update-profile', updateProfileType);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-code', verifyResetCode);
router.post('/reset-password', resetPassword);

module.exports = router;