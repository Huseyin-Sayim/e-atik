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
  collectWasteRequest,
} = require('../../controllers/api/wasteRequestController');

const router = express.Router();

const supervisorRoles = [isAuth, hasRole('ADMIN', 'BOSS')];
const collectorRoles = [isAuth, hasRole('EMPLOYEE', 'ADMIN', 'BOSS')];

router.post('/', isAuth, hasRole('USER'), validate(validateSchema.wasteRequestCreate), createWasteRequest);
router.get('/mine', isAuth, hasRole('USER'), getMyWasteRequests);
router.get('/', ...collectorRoles, getAllWasteRequests);
router.post('/:id/collect', ...collectorRoles, validate(validateSchema.wasteRequestCollect), collectWasteRequest);
router.patch('/:id', ...supervisorRoles, validate(validateSchema.wasteRequestUpdate), updateWasteRequest);

module.exports = router;
