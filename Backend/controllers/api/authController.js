const {PrismaClient, Prisma} = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {sendVerificationMail, sendResetPasswordMail} = require("../../services/mailServices");
const crypto = require('crypto');

const prisma = new PrismaClient();

const register = async (req, res) => {
  try{
    const {name, email, password, phoneNumber, role, employeeType} = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password : hashedPassword,
        phoneNumber,
        role,
        employeeType
      }
    })
    res.status(201).json({
      message: "success",
      data: user
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        let field = err.meta.target;
        return res.status(400).json({
          message: `bu ${field} zaten kayıtlı.`,
          error: 'DUPLICATE_FIELD'
        })
      }
    }

    res.status(500).json({
      message: "Kullanıcı oluşturulamadı."
    })
  }
}

const login = async (req, res) => {
  try{
    const {email, password} = req.body;
    const user = await prisma.user.findUnique({
      where: {
        email
      }
    })

    if (!user) {
      return res.status(404).json({
        message: 'kullanıcı bulunamadı'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: 'hatalı şifre girdiniz lütfen tekrar deneyiniz!'
      })
    }

    const refreshToken = jwt.sign(
        {userId: user.id, role: user.role },
        process.env.REFRESH_SECRET_KEY,
        {expiresIn: '7d'}
    );

    const accessToken = jwt.sign(
        {userId: user.id , role: user.role},
        process.env.ACCESS_SECRET_KEY,
        {expiresIn: '30m'}
    )

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiredAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    })

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: "strict", // CSRF SALDIRILARI İCİN ÖNLEM
      maxAge: 30 * 60 * 1000
    })

    res.status(200).json({
      message: 'giriş başarılı',
      user: {id: user.id, name: user.name, email: user.email, role: user.role},
      refreshToken,
      accessToken
    })
  } catch (err) {
    res.status(500).json({
      message: 'giriş başarısız',
      error: err.message
    })
  }
}

const sendMailVerificationCode = async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: {
        id: req.user.userId
      }
    });

    if (!user) {
      return res.status(404).json({message: 'Kullanıcı Bulunamadı'});
    }

    const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.verificationCode.deleteMany({
      where: {
        userId: user.id
      }
    });

    await prisma.verificationCode.create({
      data: {
        code: newVerificationCode,
        userId: user.id,
        expiredAt: new Date(Date.now() + 5 * 60 * 1000)
      }
    })

    await sendVerificationMail(user.email, newVerificationCode);

    return res.status(201).json({message: 'Doğrulama Kodu Gönderildi'});
  } catch (err) {
    res.status(500).json({
      message: 'Doğrulama Kodu Gönderilemedi',
      error: err.message
    });
  }
}

const verifyMail = async (req, res) => {
  try {
    const {code} = req.params;
    const user = req.user;

    if (!user) {
      return res.status(404).json({message: 'Kullanıcı bulunamadı'});
    }

    if (!code) {
      return res.status(400).json({message: 'Doğrulama kodu yok!'});
    }

    const verifyCode = await prisma.verificationCode.findUnique({
      where: {userId : user.userId}
    });

    if (!code === verifyCode.code) {
      return res.status('404').json({message: 'Doğrulama kodu hatalı'})
    } else if (verifyCode.expiredAt < new Date()) {
      await prisma.verificationCode.delete({
        where: {userId: user.userId}
      })
      return res.status(401).json({message: 'Doğrulama kodu süresi doldu'});
    }

    await prisma.user.update({
      where: {id: user.userId},
      data: {isVerified: true}
    })

    return res.status(200).json({message: 'Doğrulama başarılı'});
  } catch (err) {
    console.log(err.message)
    res.status(500).json({message: 'Doğrulama başarısız', error: err.message});
  }
}

const generateResetToken = async (req, res) => {
  try {
    const {email} = req.body;

    const user = await prisma.user.findUnique({
      where: {email: email}
    })

    if (!user) {
      return res.status(404).json({message: 'Kullanıcı bulunamadı'});
    }

    const token = crypto.randomBytes(32).toString('hex');

    await prisma.resetToken.deleteMany({
      where: {
        userId: user.id
      }
    })

    await prisma.resetToken.create({
      data: {
        token: token,
        userId: user.id,
        expiredAt: new Date(Date.now() + 5 * 60 * 1000)
      }
    })

    await sendResetPasswordMail(user.email, token);

    return res.status(200).json({message: 'şifre sıfırlama linki mail adresinize gönderildi'})
  } catch (err) {
    return res.status(500).json({message: 'şifre sıfırlama linki gönderilemedi', error: err.message})
  }
}

const resetPassword = async (req, res) => {
  try {
    const {token} = req.params;
    const resetToken = await prisma.resetToken.findUnique({
      where: {token: token}
    })

    if (!resetToken.token) {
      return res.status(404).json({message: 'şifre sıfırlama linki bulunamadı'});
    } else if (resetToken.expiredAt < new Date()) {
      await prisma.resetToken.delete({
        where: {token: token}
      })
      return res.status(401).json({message: 'şifre sıfırlama linki süresi doldu'});
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    await prisma.user.update({
      where: {id: resetToken.userId},
      data: {password: hashedPassword}
    })

    await prisma.resetToken.delete({
      where: {token: token}
    })

    return res.status(200).json({message: 'şifre sıfırlama başarılı'})
  } catch (err) {
    return res.status(err.code).json({message: 'şifre sıfırlama başarısız', error: err.message});
  }
}

module.exports = {
  register,
  login,
  sendMailVerificationCode,
  verifyMail,
  generateResetToken,
  resetPassword
}