const express = require('express');
const isAuth = require('../middleware/authentication');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const router = express.Router();

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

router.get('/', isAuth ,(req, res) => {
  res.render('pages/dashboard');
});

module.exports = router;