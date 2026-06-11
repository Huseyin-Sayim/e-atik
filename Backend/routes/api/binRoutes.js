const express = require('express');
const validate = require('../../middleware/authValidate');
const validateSchema = require('../../validations/validateSchema');
const isAuth = require('../../middleware/authentication');
const { PrismaClient } = require('@prisma/client');
const {
  getBins,
  getBinById,
  createBin,
  updateBin,
  deleteBin,
  seedDefaultBins,
  collectBin,
  updateBinFullness,
} = require('../../controllers/api/binController');

const router = express.Router();
const prisma = new PrismaClient();

// Kurumsal (profileType === 'kurumsal') kullanıcılar ve yetkili personel (role: ADMIN, BOSS, EMPLOYEE)
// akıllı atık kutularını oluşturma ve güncelleme yetkisine sahiptir.
const isCorporateOrStaff = async (req, res, next) => {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({ message: 'Giriş yapınız!' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true, profileType: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }

    const isStaff = ['ADMIN', 'BOSS', 'EMPLOYEE'].includes(user.role);
    const isCorporate = user.profileType === 'kurumsal' || user.profileType === 'CORPORATE';

    if (!isStaff && !isCorporate) {
      return res.status(403).json({ message: 'Yetkisiz erişim! Bu işlem için kurumsal hesaba veya yetkili personel rolüne sahip olmanız gerekir.' });
    }

    next();
  } catch (err) {
    console.error('Yetkilendirme hatası:', err);
    return res.status(500).json({ error: 'Sunucu yetkilendirme hatası.' });
  }
};

const canDeleteBins = async (req, res, next) => {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({ message: 'Giriş yapınız!' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true, profileType: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }

    const isAdminBoss = ['ADMIN', 'BOSS'].includes(user.role);
    const isCorporate = user.profileType === 'kurumsal' || user.profileType === 'CORPORATE';

    if (!isAdminBoss && !isCorporate) {
      return res.status(403).json({ message: 'Silme yetkisi yalnızca yöneticiler içindir.' });
    }

    next();
  } catch (err) {
    console.error('Yetkilendirme hatası:', err);
    return res.status(500).json({ error: 'Sunucu yetkilendirme hatası.' });
  }
};

const collectorRoles = [isAuth, isCorporateOrStaff];
const authGuard = [isAuth, isCorporateOrStaff];
const deleteGuard = [isAuth, canDeleteBins];

router.get('/', getBins);
router.post('/:id/collect', ...collectorRoles, collectBin);
router.get('/:id', getBinById);

router.post('/', ...authGuard, validate(validateSchema.binCreate), createBin);
router.post('/create', ...authGuard, validate(validateSchema.binCreate), createBin);

router.patch('/:id/fullness', isAuth, updateBinFullness);
router.patch('/:id', ...authGuard, validate(validateSchema.binUpdate), updateBin);
router.put('/:id', ...authGuard, validate(validateSchema.binUpdate), updateBin);
router.delete('/:id', ...deleteGuard, deleteBin);

module.exports = router;
