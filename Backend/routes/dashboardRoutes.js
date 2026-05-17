const express = require('express');
const isAuth = require('../middleware/authentication');
const loadCurrentUser = require('../middleware/loadCurrentUser');
const requirePageRole = require('../middleware/requirePageRole');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const router = express.Router();


// DASHBOARD AUTH ROUTES

router.get('/login', (req, res) => {
  res.render('pages/auth/login');
});

router.get('/register', (req, res) => {
  res.render('pages/auth/register');
});

router.get('/forgot-password', (req, res) => {
  res.render('pages/auth/forgotPassword');
});

router.get('/reset/password/:token', async (req, res) => {
  const {token} = req.params;
  const resetToken = await prisma.resetToken.findUnique({
    where: {token: token}
  })

  if (!resetToken) {
    res.send('Geçersiz Token')
    return;
  }

  res.render('pages/auth/resetPassword', {token: token});
});

// DASHBORAD

router.get('/', isAuth, loadCurrentUser, async (req, res) => {
  const regions = await prisma.region.findMany();

  res.render('pages/dashboard', {
    user: res.locals.user,
    regions: regions,
  });
});

// REGİON

router.get('/region/create', isAuth, loadCurrentUser, (req, res) => {
  res.render('pages/region/createRegion');
});

// BİN

router.get('/bin/create', isAuth, loadCurrentUser, (req, res) => {
  res.render('pages/bin/createBin');
});

// ÇALIŞAN — ÇALIŞMA BÖLGESİ

router.get('/employee/work-region', isAuth, loadCurrentUser, requirePageRole('EMPLOYEE'), async (req, res) => {
  const regions = await prisma.region.findMany({
    orderBy: { name: 'asc' },
  });

  const employee = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      regionId: true,
      region: {
        select: {
          id: true,
          name: true,
          region_id: true,
        },
      },
    },
  });

  res.render('pages/employee/selectWorkRegion', {
    user: res.locals.user,
    regions,
    selectedRegionId: employee?.regionId || '',
    selectedRegionName: employee?.region?.name || null,
  });
});

module.exports = router;