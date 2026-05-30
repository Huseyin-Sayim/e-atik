const express = require('express');
const {
  listWasteTypes,
  listWasteTypesAdmin,
  createWasteType,
  updateWasteType,
} = require('../../controllers/api/wasteTypeController');
const isAuth = require('../../middleware/authentication');
const hasRole = require('../../middleware/authorization');
const validate = require('../../middleware/authValidate');
const validateSchema = require('../../validations/validateSchema');

const router = express.Router();

const adminBoss = [isAuth, hasRole('ADMIN', 'BOSS')];

router.get('/', listWasteTypes);
router.get('/admin', ...adminBoss, listWasteTypesAdmin);
router.post('/', ...adminBoss, validate(validateSchema.wasteTypeCreate), createWasteType);
router.patch('/:id', ...adminBoss, validate(validateSchema.wasteTypeUpdate), updateWasteType);

module.exports = router;
