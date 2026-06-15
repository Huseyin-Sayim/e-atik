const express = require('express');
const validate = require('../../middleware/authValidate');
const validateSchema = require('../../validations/validateSchema');
const isAuth = require('../../middleware/authentication');
const hasRole = require('../../middleware/authorization');
const { PrismaClient } = require('@prisma/client');
const {
  createWasteRequest,
  getMyWasteRequests,
  getAllWasteRequests,
  updateWasteRequest,
  collectWasteRequest,
} = require('../../controllers/api/wasteRequestController');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Kurumsal (profileType === 'kurumsal') kullanıcılar VE yetkili personel
 * (role: ADMIN, BOSS, EMPLOYEE) tüm atık taleplerini görebilir.
 */
const isCorporateOrStaff = async (req, res, next) => {
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

    const isStaff = ['ADMIN', 'BOSS', 'EMPLOYEE'].includes(user.role);
    const isCorporate =
      user.profileType === 'kurumsal' || user.profileType === 'CORPORATE';

    if (!isStaff && !isCorporate) {
      return res.status(403).json({
        message:
          'Yetkisiz erişim! Bu işlem için kurumsal hesaba veya yetkili personel rolüne sahip olmanız gerekir.',
      });
    }

    next();
  } catch (err) {
    console.error('Yetkilendirme hatası:', err);
    return res.status(500).json({ error: 'Sunucu yetkilendirme hatası.' });
  }
};

const supervisorRoles = [isAuth, hasRole('ADMIN', 'BOSS')];
// collectorRoles artık kurumsal kullanıcıları da kapsar
const collectorRoles = [isAuth, isCorporateOrStaff];

// Kişisel kullanıcılar talep oluşturabilir
router.post('/', isAuth, hasRole('USER'), validate(validateSchema.wasteRequestCreate), createWasteRequest);
// Kişisel kullanıcılar kendi taleplerini görebilir
router.get('/mine', isAuth, hasRole('USER'), getMyWasteRequests);
// Kurumsal/personel tüm talepleri görebilir (eski: sadece EMPLOYEE/ADMIN/BOSS → artık kurumsal da dahil)
router.get('/', ...collectorRoles, getAllWasteRequests);
// Kurumsal/personel taleplerini toplayabilir
router.post('/:id/collect', ...collectorRoles, validate(validateSchema.wasteRequestCollect), collectWasteRequest);
// Kurumsal/personel talep durumunu güncelleyebilir (ON_ROUTE vb.)
router.patch('/:id', ...collectorRoles, validate(validateSchema.wasteRequestUpdate), updateWasteRequest);

module.exports = router;
