const express = require('express');
const validate = require('../../middleware/authValidate')
const validateSchema = require('../../validations/validateSchema');
const {register, login, sendMailVerificationCode, verifyMail, generateResetToken, resetPassword} = require("../../controllers/api/authController");
const isAuth = require('../../middleware/authentication');

const router = express.Router();

router.post('/register', validate(validateSchema.register), register);
router.post('/login', validate(validateSchema.login), login);
router.get('/verify/mail', isAuth , sendMailVerificationCode);
router.get('/verify/mail/:code', isAuth, verifyMail)
router.post('/reset/password', validate(validateSchema.resetPassMail) ,generateResetToken);
router.get('/reset/password/:token', async (req, res) => {
  //   Burada bir web sayfası render edecek views içinde
});
router.post('/reset/password/:token', validate(validateSchema.resetPassword) ,resetPassword);

module.exports = router;