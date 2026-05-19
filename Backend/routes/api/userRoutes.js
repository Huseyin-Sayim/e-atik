const express = require('express');
const { getUsers, updateWorkRegion, deleteUser, getUserTransactions } = require('../../controllers/api/userController');
const isAuth = require('../../middleware/authentication.js');
const hasRole = require('../../middleware/authorization.js');
const validate = require('../../middleware/authValidate');
const validateSchema = require('../../validations/validateSchema');

const router = express.Router();

router.get('/', isAuth, getUsers);
router.patch('/me/work-region', isAuth, hasRole('EMPLOYEE'), validate(validateSchema.workRegionUpdate), updateWorkRegion);
router.get('/delete/:id', isAuth, hasRole('USER'), deleteUser);
router.get('/transactions', isAuth, getUserTransactions);

module.exports = router;