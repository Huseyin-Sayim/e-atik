const express = require('express');
const validate = require('../../middleware/authValidate')
const validateSchema = require('../../validations/validateSchema');
const {register, login, sendMailVerificationCode, verifyMail, generateResetToken, resetPassword, logout} = require("../../controllers/api/authController");
const isAuth = require('../../middleware/authentication');

const router = express.Router();

router.post('/register', validate(validateSchema.register), register);
router.post('/login', validate(validateSchema.login), login);
router.get('/verify/mail', isAuth , sendMailVerificationCode);
router.get('/verify/mail/:code', isAuth, verifyMail)
router.post('/reset/password', validate(validateSchema.resetPassMail) ,generateResetToken);
router.post('/reset/password/:token', validate(validateSchema.resetPassword) ,resetPassword);
router.get('/logout', isAuth, logout);

module.exports = router;