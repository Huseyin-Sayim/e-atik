const express = require('express');
const validate = require('../../middleware/authValidate');
const validateSchema = require('../../validations/validateSchema');
const isAuth = require('../../middleware/authentication');
const hasRole = require('../../middleware/authorization');
const {
  getBins,
  getBinById,
  createBin,
  updateBin,
  deleteBin,
  seedDefaultBins,
  collectBin,
} = require('../../controllers/api/binController');

const router = express.Router();

const adminBoss = [isAuth, hasRole('ADMIN', 'BOSS')];
const collectorRoles = [isAuth, hasRole('EMPLOYEE', 'ADMIN', 'BOSS')];

router.post('/seed', seedDefaultBins);

router.get('/', getBins);
router.post('/:id/collect', ...collectorRoles, collectBin);
router.get('/:id', getBinById);

router.post('/', ...adminBoss, validate(validateSchema.binCreate), createBin);
router.post('/create', ...adminBoss, validate(validateSchema.binCreate), createBin);

router.patch('/:id', ...adminBoss, validate(validateSchema.binUpdate), updateBin);
router.put('/:id', ...adminBoss, validate(validateSchema.binUpdate), updateBin);
router.delete('/:id', ...adminBoss, deleteBin);

module.exports = router;
