const express = require('express');
const {getUsers} = require("../../controllers/api/userController");
const isAuth = require('../../middleware/authentication.js')

const router = express.Router();

router.get('/', isAuth ,getUsers);

module.exports = router;