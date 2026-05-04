const express = require('express');
const {getUsers, deleteUser} = require("../../controllers/api/userController");
const isAuth = require('../../middleware/authentication.js')
const hasRole = require('../../middleware/authorization.js')

const router = express.Router();

router.get('/', isAuth ,getUsers);
router.get('/delete/:id', isAuth, hasRole('USER'), deleteUser)

module.exports = router;