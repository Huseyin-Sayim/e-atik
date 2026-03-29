const express = require('express');
const {getUsers} = require("../../controllers/api/userController");

const router = express.Router();

router.get('/', getUsers);

module.exports = router;