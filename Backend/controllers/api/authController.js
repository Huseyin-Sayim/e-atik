const {PrismaClient, Prisma} = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {sendVerificationMail, sendResetPasswordMail, sendWelcomeMail, sendEmailChangeMail, sendPasswordChangeMail, sendEmailChangeVerificationMail} = require("../../services/mailServices");
const crypto = require('crypto');

const prisma = new PrismaClient();

const register = async (req, res) => {
  try{
    const {name, surname, email, password, phoneNumber, role, employeeType, city, district} = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        surname,
        email,
        password : hashedPassword,
        phoneNumber,
        role,
        employeeType,
        city,
        district
      }
    })
    res.status(201).json({
      message: "success",
      data: user
    })

    // Kayıt başarılı olduktan sonra arka planda hoş geldin maili gönder
    sendWelcomeMail(user.email, user.name).catch(err => {
      console.error('Welcome mail error:', err);
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        const target = err.meta && err.meta.target;
        let duplicateField = 'veri';
        if (Array.isArray(target)) {
          if (target.includes('email')) duplicateField = 'e-posta adresi';
          else if (target.includes('phoneNumber')) duplicateField = 'telefon numarası';
        } else if (typeof target === 'string') {
          if (target.includes('email')) duplicateField = 'e-posta adresi';
          else if (target.includes('phoneNumber')) duplicateField = 'telefon numarası';
        }
        return res.status(400).json({
          message: `Bu ${duplicateField} zaten başka bir hesap tarafından kullanılmaktadır.`,
          error: 'DUPLICATE_FIELD'
        });
      }
    }

    res.status(500).json({
      message: "Kullanıcı oluşturulamadı.",
      error: err.message
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
        message: 'Kullanıcı bulunamadı'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: 'Hatalı şifre girdiniz lütfen tekrar deneyiniz!'
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
        {expiresIn: '7d'}
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
      maxAge: 7 * 24 * 60 * 60 * 1000
    })

    res.status(200).json({
      message: 'Giriş başarılı.',
      user: {
        id: user.id, 
        name: user.name, 
        surname: user.surname,
        email: user.email, 
        role: user.role,
        profileImage: user.profileImage,
        profileType: user.profileType,
        city: user.city,
        district: user.district
      },
      refreshToken,
      accessToken
    })
  } catch (err) {
    console.error('❌ Login controller error:', err);
    res.status(500).json({
      message: 'Giriş işlemi başarısız oldu.',
      error: err.message
    })
  }
}

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const { userId } = req.user;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Mevcut şifreniz hatalı.' });

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });

    // Güvenlik Maili Gönder
    await sendPasswordChangeMail(user.email);

    res.status(200).json({ message: 'Şifreniz başarıyla değiştirildi.' });
  } catch (err) {
    res.status(500).json({ message: 'Şifre değiştirilirken bir hata oluştu.', error: err.message });
  }
}

const requestEmailChange = async (req, res) => {
  try {
    const { newEmail } = req.body;
    const { userId } = req.user;

    if (!newEmail) return res.status(400).json({ message: 'Yeni e-posta adresi gereklidir.' });

    // 1. E-posta daha önce alınmış mı kontrol et
    const existingUser = await prisma.user.findUnique({ where: { email: newEmail.toLowerCase() } });
    if (existingUser) return res.status(400).json({ message: 'Bu e-posta adresi zaten başka bir hesap tarafından kullanılıyor.' });

    // 2. 6 Haneli Kod Üret
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Veritabanına Kaydet (Varsa eskisini silerek)
    await prisma.verificationCode.upsert({
      where: { userId },
      update: {
        code: verificationCode,
        targetEmail: newEmail.toLowerCase(),
        createdAt: new Date(),
        expiredAt: new Date(Date.now() + 10 * 60 * 1000) // 10 dakika
      },
      create: {
        userId,
        code: verificationCode,
        targetEmail: newEmail.toLowerCase(),
        expiredAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    });

    // 4. Yeni Maile Kodu Gönder
    await sendEmailChangeVerificationMail(newEmail.toLowerCase(), verificationCode);

    res.status(200).json({ message: 'Doğrulama kodu yeni e-posta adresinize gönderildi.' });
  } catch (err) {
    console.error('Email change request error:', err);
    res.status(500).json({ message: 'Kod gönderilirken bir hata oluştu.', error: err.message });
  }
}

const verifyEmailChange = async (req, res) => {
  try {
    const { code, newEmail } = req.body;
    const { userId } = req.user;

    // 1. Kodu kontrol et
    const record = await prisma.verificationCode.findUnique({ where: { userId } });

    if (!record || record.code !== code || record.targetEmail !== newEmail.toLowerCase()) {
      return res.status(400).json({ message: 'Geçersiz doğrulama kodu.' });
    }

    if (new Date() > record.expiredAt) {
      return res.status(400).json({ message: 'Kodun süresi dolmuş.' });
    }

    // 2. Kullanıcıyı bul
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const oldEmail = user.email;

    // 3. E-postayı Güncelle
    await prisma.user.update({
      where: { id: userId },
      data: { email: newEmail.toLowerCase() }
    });

    // 4. Kod Kaydını Sil
    await prisma.verificationCode.delete({ where: { userId } });

    // 5. Bilgilendirme Mailleri Gönder
    await sendEmailChangeMail(oldEmail, newEmail.toLowerCase());

    res.status(200).json({ message: 'E-posta adresiniz başarıyla güncellendi.' });
  } catch (err) {
    console.error('Email verification error:', err);
    res.status(500).json({ message: 'Doğrulama sırasında bir hata oluştu.', error: err.message });
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

const logout = async (req, res) => {
  try {
    const userId = req.user.userId;

    await prisma.refreshToken.deleteMany({
      where: {userId: userId}
    });

    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: "strict",
      path: '/'
    });

    return res.status(200).json({ message: "Başarıyla çıkış yapıldı ve oturumlar sonlandırıldı." });
  } catch (err) {
    console.error("Logout hatası:", err);
    return res.status(500).json({ message: "Çıkış yapılırken bir hata oluştu." });
  }
}

module.exports = {
  register,
  login,
  sendMailVerificationCode,
  verifyMail,
  generateResetToken,
  resetPassword,
  logout,
  changePassword,
  requestEmailChange,
  verifyEmailChange
}