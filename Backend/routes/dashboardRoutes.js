const express = require('express');
const jwt = require('jsonwebtoken');
const isAuth = require('../middleware/authentication');
const loadCurrentUser = require('../middleware/loadCurrentUser');
const requirePageRole = require('../middleware/requirePageRole');
const { PrismaClient } = require('@prisma/client');
const { getRecyclingStatsForDashboard } = require('../services/recyclingStats');
const { getRegionFullnessAlerts } = require('../services/employeeRegionAlerts');

const prisma = new PrismaClient();

const router = express.Router();

function hasValidSession(req) {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.accessToken;
  if (!token) return false;
  try {
    jwt.verify(token, process.env.ACCESS_SECRET_KEY);
    return true;
  } catch {
    return false;
  }
}


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

// LANDING (public)

router.get('/', (req, res) => {
  res.render('pages/landing', {
    showDashboardLink: hasValidSession(req),
  });
});

// DASHBOARD

const binManagerRoles = requirePageRole('ADMIN', 'BOSS', 'EMPLOYEE');

router.get('/dashboard', isAuth, loadCurrentUser, async (req, res) => {
  const tasks = [
    prisma.region.findMany(),
    getRecyclingStatsForDashboard(prisma, {
      userId: res.locals.user?.role === 'USER' ? req.user.userId : null,
    }),
  ];

  if (res.locals.user?.role === 'EMPLOYEE') {
    tasks.push(getRegionFullnessAlerts(req.user.userId));
  }

  const results = await Promise.all(tasks);
  const regions = results[0];
  const recyclingStats = results[1];
  const regionFullnessAlerts =
    res.locals.user?.role === 'EMPLOYEE' ? results[2] : null;

  res.render('pages/dashboard', {
    user: res.locals.user,
    regions,
    recyclingStats,
    regionFullnessAlerts,
  });
});

// KULLANICI — KİŞİSEL GERİ DÖNÜŞÜM (taslak)

router.get('/user/my-recycling', isAuth, loadCurrentUser, requirePageRole('USER'), (req, res) => {
  res.render('pages/user/myRecycling', {
    user: res.locals.user,
  });
});

router.get('/user/waste-request', isAuth, loadCurrentUser, requirePageRole('USER'), (req, res) => {
  res.render('pages/user/wasteRequest', {
    user: res.locals.user,
  });
});

// REGİON

router.get('/region/create', isAuth, loadCurrentUser, binManagerRoles, (req, res) => {
  res.render('pages/region/createRegion');
});

// BİN

router.get('/bin/create', isAuth, loadCurrentUser, binManagerRoles, (req, res) => {
  res.render('pages/bin/createBin', { user: res.locals.user });
});

// ADMIN / BOSS — ÇALIŞAN DURUMLARI

const supervisorRoles = requirePageRole('ADMIN', 'BOSS');

router.get('/admin/employee-status', isAuth, loadCurrentUser, supervisorRoles, (req, res) => {
  res.render('pages/admin/employeeStatus', {
    user: res.locals.user,
  });
});

router.get('/admin/waste-requests', isAuth, loadCurrentUser, supervisorRoles, (req, res) => {
  res.render('pages/admin/wasteRequests', {
    user: res.locals.user,
  });
});

router.get('/admin/users', isAuth, loadCurrentUser, supervisorRoles, (req, res) => {
  res.render('pages/admin/users', {
    user: res.locals.user,
  });
});

router.get('/admin/waste-types', isAuth, loadCurrentUser, supervisorRoles, (req, res) => {
  res.render('pages/admin/wasteTypes', {
    user: res.locals.user,
  });
});

router.get('/admin/employee-tracking', (req, res) => {
  res.redirect(301, '/admin/employee-status');
});

// ÇALIŞAN — BENİM ROTAM (taslak)

router.get('/employee/my-route', isAuth, loadCurrentUser, requirePageRole('EMPLOYEE'), (req, res) => {
  res.render('pages/employee/myRoute', {
    user: res.locals.user,
  });
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