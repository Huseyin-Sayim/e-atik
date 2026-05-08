const express = require('express');
const isAuth = require('../middleware/authentication');
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

router.get('/', isAuth , async (req, res) => {
  console.log(req.user)

  const user = await prisma.user.findUnique({
    where: {
      id : req.user.userId
    },
    select: {
      name: true,
      email: true,
      role: true,
      employeeType: true
    }
  });

  const regions = await prisma.region.findMany();

  res.render('pages/dashboard', {
    user: user,
    regions: regions
  });
});

// REGİON

router.get('/region/create', (req, res) => {
  res.render('pages/region/createRegion')
})

// BİN

router.get('/bin/create', (req, res) => {
  res.render('pages/bin/createBin')
})

module.exports = router;