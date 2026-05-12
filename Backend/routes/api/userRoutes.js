const express = require('express');
const {getUsers, deleteUser, updateProfile} = require("../../controllers/api/userController");
const isAuth = require('../../middleware/authentication.js')
const hasRole = require('../../middleware/authorization.js')

const router = express.Router();

router.get('/', isAuth ,getUsers);
router.get('/delete/:id', isAuth, hasRole('USER'), deleteUser)
router.put('/update-profile', updateProfile);

module.exports = router;