const {PrismaClient} = require("@prisma/client");
const nodemailer = require("nodemailer");

const prisma = new PrismaClient();

const getUsers =  async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.status(200).json({
      message: "success",
      data: users
    })
  } catch (err) {
    res.status(500).json({
      message: "Kullanıcılar getirilemedi."
    })
  }
}

const register = async (req, res) => {
  try {
    const { fullName, city, district, email, password } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(400).json({ message: "Bu e-posta adresi zaten kullanımda." });
    }

    const newUser = await prisma.user.create({
      data: {
        fullName,
        city,
        district,
        email: email.toLowerCase(),
        password, // Gelişmiş projelerde bcrypt ile hashlenmeli
      }
    });

    // Hoş geldin maili gönderme işlemi (Arka planda çalışır, kaydı engellemez)
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email.toLowerCase(),
        subject: 'Akıllı Kova Ailesine Hoş Geldiniz! 🌱',
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #2e7d32; text-align: center;">Aramıza Hoş Geldin, ${fullName}! 🌳</h2>
            <p style="font-size: 16px; line-height: 1.5;">
              Akıllı Kova uygulamasına katıldığın için çok mutluyuz. Senin gibi çevreye duyarlı bireyler sayesinde dünyamız nefes alıyor.
            </p>
            <p style="font-size: 16px; line-height: 1.5;">
              Geri dönüşüme kazandırdığın her bir atıkla enerji kullanımını %80 azaltacak ve ağaçları hayata bağlayacaksın. Doğaya katkıların için şimdiden teşekkür ederiz!
            </p>
            <div style="text-align: center; margin-top: 30px;">
              <p style="font-size: 14px; color: #666;">Daha yeşil bir gelecek için hep birlikte!</p>
              <p style="font-weight: bold; color: #2e7d32;">Akıllı Kova Ekibi</p>
            </div>
          </div>
        `
      };

      transporter.sendMail(mailOptions).catch(err => console.error("Hoş geldin maili hatası:", err));
    } catch (mailErr) {
      console.error("Mail hazırlama hatası:", mailErr);
    }

    res.status(201).json({
      message: "Kayıt başarılı",
      data: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName
      }
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Kayıt sırasında bir hata oluştu." });
  }
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Geçersiz e-posta veya şifre." });
    }

    res.status(200).json({
      message: "Giriş başarılı",
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        profileType: user.profileType
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Giriş sırasında bir hata oluştu." });
  }
}

const updateProfileType = async (req, res) => {
  try {
    const { email, profileType } = req.body;

    if (!email || !profileType) {
      return res.status(400).json({ message: "E-posta ve profil tipi gereklidir." });
    }

    const updatedUser = await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { profileType }
    });

    res.status(200).json({
      message: "Profil tipi güncellendi.",
      data: {
        email: updatedUser.email,
        profileType: updatedUser.profileType
      }
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Profil güncellenirken hata oluştu." });
  }
}

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("[FORGOT PASSWORD] İstek alınan e-posta:", email);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      console.log("[FORGOT PASSWORD] Kullanıcı bulunamadı.");
      return res.status(404).json({ message: "Böyle bir e-posta kayıtlı değil." });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { resetCode, resetCodeExpiry }
    });
    console.log("[FORGOT PASSWORD] Veritabanı güncellendi, kod:", resetCode);

    // Nodemailer configuration
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Akıllı Kova Şifre Sıfırlama Kodu',
      text: `Şifre sıfırlama kodunuz: ${resetCode}\nBu kod 15 dakika geçerlidir.\n\nAkıllı Kova Ekibi`
    };

    console.log("[FORGOT PASSWORD] Mail gönderiliyor...");
    await transporter.sendMail(mailOptions);
    console.log("[FORGOT PASSWORD] Mail başarıyla gönderildi!");

    res.status(200).json({ message: "Doğrulama kodu e-posta adresinize gönderildi." });
  } catch (err) {
    console.error("[FORGOT PASSWORD] HATA DETAYI:", err);
    res.status(500).json({ message: "İşlem sırasında bir hata oluştu.", error: err.message });
  }
}

const verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user || user.resetCode !== code || new Date() > user.resetCodeExpiry) {
      return res.status(400).json({ message: "Geçersiz veya süresi dolmuş kod." });
    }

    res.status(200).json({ message: "Kod doğrulandı." });
  } catch (err) {
    console.error("Verify code error:", err);
    res.status(500).json({ message: "İşlem sırasında bir hata oluştu." });
  }
}

const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user || user.resetCode !== code || new Date() > user.resetCodeExpiry) {
      return res.status(400).json({ message: "Geçersiz veya süresi dolmuş kod." });
    }

    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: {
        password: newPassword,
        resetCode: null,
        resetCodeExpiry: null
      }
    });

    res.status(200).json({ message: "Şifreniz başarıyla güncellendi." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "İşlem sırasında bir hata oluştu." });
  }
}

module.exports = {
  getUsers,
  register,
  login,
  updateProfileType,
  forgotPassword,
  verifyResetCode,
  resetPassword
}