const express = require('express');
const validate = require('../../middleware/authValidate');
const validateSchema = require('../../validations/validateSchema');
const isAuth = require('../../middleware/authentication');
const hasRole = require('../../middleware/authorization');
const {
  createWasteRequest,
  getMyWasteRequests,
  getAllWasteRequests,
  updateWasteRequest,
} = require('../../controllers/api/wasteRequestController');

const router = express.Router();

router.post('/', isAuth, hasRole('USER'), validate(validateSchema.wasteRequestCreate), createWasteRequest);
router.get('/mine', isAuth, hasRole('USER'), getMyWasteRequests);
router.get('/', isAuth, hasRole('ADMIN'), getAllWasteRequests);
router.patch('/:id', isAuth, hasRole('ADMIN'), validate(validateSchema.wasteRequestUpdate), updateWasteRequest);

module.exports = router;
