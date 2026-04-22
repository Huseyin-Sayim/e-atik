const express = require('express');
const validate = require('../../middleware/authValidate')
const validateSchema = require('../../validations/validateSchema');
const {register, login} = require("../../controllers/api/authController");

const router = express.Router();

router.post('/register', validate(validateSchema.register), register);
router.post('/login', validate(validateSchema.login), login)

module.exports = router;