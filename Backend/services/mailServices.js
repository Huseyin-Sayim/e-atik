const nodemailer = require('nodemailer');

const createTransport = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const sendVerificationMail = async (email, code) => {
  const transporter = createTransport();

  const mailOptions = {
    from: `Akıllı Kova: ${process.env.SMTP_USER}`,
    to: email,
    subject: 'Akıllı Kova - Email Adresi Doğrulama',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              .mail-wrapper {
                  font-family: 'Arial', sans-serif;
                  background-color: #f8f9fa;
                  padding: 40px;
                  text-align: center;
              }
              .card {
                  max-width: 400px;
                  margin: 0 auto;
                  background: #ffffff;
                  padding: 30px;
                  border-radius: 12px;
                  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                  border: 1px solid #e1e4e8;
              }
              .logo {
                  color: #2ecc71;
                  font-size: 24px;
                  font-weight: bold;
                  margin-bottom: 20px;
              }
              .code-text {
                  font-size: 14px;
                  color: #6a737d;
                  margin-bottom: 10px;
              }
              .code {
                  font-size: 24px;
                  font-weight: 800;
                  color: #24292e;
                  letter-spacing: 8px;
                  padding: 10px;
                  background: #f1f8e9;
                  border-radius: 8px;
                  display: inline-block;
                  margin: 8px 0;
                  border: 1px dashed #2ecc71;
              }
              .footer {
                  margin-top: 20px;
                  font-size: 12px;
                  color: #959da5;
              }
          </style>
      </head>
      <body>
          <div class="mail-wrapper">
              <div class="card">
                  <div class="logo">Akıllı Kova</div>
                  <p style="color: #24292e; font-weight: 600;">Hesap Doğrulama</p>
                  <p class="code-text">Hesabınızı onaylamak için aşağıdaki kodu kullanın:</p>
                  
                  <div class="code">${code}</div>
                  
                  <p style="font-size: 13px; color: #d73a49;">Bu kod 5 dakika boyunca geçerlidir.</p>
              </div>
              <div class="footer">
                  Akıllı Kova Geri Dönüşüm Sistemi © ${new Date().getFullYear()}
              </div>
          </div>
      </body>
      </html>
    `,
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    return {success: true, messageId: info.messageId}
  } catch (err) {
    console.log('Mail Gönderme Hatası: ' , err)
    throw err;
  }
}

const sendEmailChangeVerificationMail = async (email, code) => {
  const transporter = createTransport();

  const mailOptions = {
    from: `Akıllı Kova: ${process.env.SMTP_USER}`,
    to: email,
    subject: 'Akıllı Kova - E-posta Değişikliği Onay Kodu',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              .mail-wrapper { font-family: 'Arial', sans-serif; background-color: #f8f9fa; padding: 40px; text-align: center; }
              .card { max-width: 400px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e1e4e8; }
              .logo { color: #2ecc71; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
              .code { font-size: 28px; font-weight: 800; color: #2e7d32; letter-spacing: 8px; padding: 15px; background: #e8f5e9; border-radius: 8px; display: inline-block; margin: 15px 0; border: 1px dashed #2ecc71; }
              .footer { margin-top: 20px; font-size: 12px; color: #959da5; }
          </style>
      </head>
      <body>
          <div class="mail-wrapper">
              <div class="card">
                  <div class="logo">Akıllı Kova</div>
                  <p style="color: #24292e; font-weight: 600;">E-posta Değişikliği Onayı</p>
                  <p style="color: #666; font-size: 14px;">E-posta adresinizi değiştirmek için aşağıdaki doğrulama kodunu kullanın:</p>
                  
                  <div class="code">${code}</div>
                  
                  <p style="font-size: 12px; color: #d73a49;">Bu kod 10 dakika boyunca geçerlidir. Eğer bu işlemi siz yapmadıysanız bu maili görmezden gelebilirsiniz.</p>
              </div>
              <div class="footer">
                  Akıllı Kova Geri Dönüşüm Sistemi © ${new Date().getFullYear()}
              </div>
          </div>
      </body>
      </html>
    `,
  }

  try {
    await transporter.sendMail(mailOptions);
    return {success: true}
  } catch (err) {
    console.log('E-posta Onay Maili Hatası: ', err);
    throw err;
  }
}

const sendResetPasswordMail = async (email, token) => {
  const transporter = createTransport();
  const verificationLink = process.env.BASE_URL;

  const mailOptions = {
    from: `Akıllı Kova: ${process.env.SMTP_USER}`,
    to: email,
    secure: process.env.SMTP_SECURE === "true",
    subject: 'Akıllı Kova - Şifre Sıfırlama',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              .mail-wrapper {
                  font-family: 'Arial', sans-serif;
                  background-color: #f8f9fa;
                  padding: 40px;
                  text-align: center;
              }
              .card {
                  max-width: 400px;
                  margin: 0 auto;
                  background: #ffffff;
                  padding: 30px;
                  border-radius: 12px;
                  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                  border: 1px solid #e1e4e8;
              }
              .logo {
                  color: #2ecc71;
                  font-size: 24px;
                  font-weight: bold;
                  margin-bottom: 20px;
              }
              .code-text {
                  font-size: 14px;
                  color: #6a737d;
                  margin-bottom: 10px;
              }
              .code {
                  font-size: 14px;
                  font-weight: 800;
                  color: #24292e;
                  letter-spacing: 8px;
                  padding: 10px;
                  background: #f1f8e9;
                  border-radius: 8px;
                  display: inline-block;
                  margin: 8px 0;
                  border: 1px dashed #2ecc71;
              }
              .footer {
                  margin-top: 20px;
                  font-size: 12px;
                  color: #959da5;
              }
          </style>
      </head>
      <body>
          <div class="mail-wrapper">
              <div class="card">
                  <div class="logo">Akıllı Kova</div>
                  <p style="color: #24292e; font-weight: 600;">Şifre Sıfırlama</p>
                  <p class="code-text">Şifre sıfırlamak için linke tıklayınız</p>
                  
                  <div class="code">
                    <a href="${verificationLink}/reset/password/${token}">${verificationLink}</a>
                  </div>
                  
                  <p style="font-size: 13px; color: #d73a49;">Bu link 5 dakika boyunca geçerlidir.</p>
              </div>
              <div class="footer">
                  Akıllı Kova Geri Dönüşüm Sistemi © ${new Date().getFullYear()}
              </div>
          </div>
      </body>
      </html>
    `,
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    return {success: true, messageId: info.messageId}
  } catch (err) {
    console.log('Mail Gönderme Hatası: ' , err)
    throw err;
  }
}

const sendWelcomeMail = async (email, name) => {
  const transporter = createTransport();

  const mailOptions = {
    from: `Akıllı Kova: ${process.env.SMTP_USER}`,
    to: email,
    subject: 'Akıllı Kova Ailesine Hoş Geldiniz! 🌱',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              .mail-wrapper {
                  font-family: 'Arial', sans-serif;
                  background-color: #f8f9fa;
                  padding: 40px;
                  text-align: center;
              }
              .card {
                  max-width: 600px;
                  margin: 0 auto;
                  background: #ffffff;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
                  border: 1px solid #e1e4e8;
                  text-align: left;
              }
              .logo {
                  color: #2ecc71;
                  font-size: 28px;
                  font-weight: bold;
                  margin-bottom: 30px;
                  text-align: center;
              }
              .welcome-text {
                  font-size: 22px;
                  font-weight: bold;
                  color: #2e7d32;
                  margin-bottom: 20px;
                  text-align: center;
              }
              .content-text {
                  font-size: 16px;
                  color: #444;
                  line-height: 1.6;
                  margin-bottom: 15px;
              }
              .footer-text {
                  font-size: 14px;
                  color: #777;
                  margin-top: 30px;
                  text-align: center;
              }
              .signature {
                  font-weight: bold;
                  color: #2e7d32;
                  margin-top: 10px;
                  text-align: center;
              }
          </style>
      </head>
      <body>
          <div class="mail-wrapper">
              <div class="card">
                  <h1 class="welcome-text">Aramıza Hoş Geldin, ${name}! 🌳</h1>
                  
                  <p class="content-text">
                      Akıllı Kova uygulamasına katıldığın için çok mutluyuz. Senin gibi çevreye duyarlı bireyler sayesinde dünyamız nefes alıyor.
                  </p>
                  
                  <p class="content-text">
                      Geri dönüşüme kazandırdığın her bir atıkla enerji kullanımını %80 azaltacak ve ağaçları hayata bağlayacaksın. Doğaya katkıların için şimdiden teşekkür ederiz!
                  </p>
                  
                  <p class="footer-text">Daha yeşil bir gelecek için hep birlikte!</p>
                  <p class="signature">Akıllı Kova Ekibi</p>
              </div>
              <div style="margin-top: 20px; font-size: 12px; color: #959da5;">
                  Akıllı Kova Geri Dönüşüm Sistemi © ${new Date().getFullYear()}
              </div>
          </div>
      </body>
      </html>
    `,
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome Message sent: %s', info.messageId);
    return {success: true, messageId: info.messageId}
  } catch (err) {
    console.log('Welcome Mail Gönderme Hatası: ' , err)
    // Hoşgeldin maili gitmese de kayıt işlemi bozulmasın diye hata fırlatmıyoruz
    return {success: false, error: err.message}
  }
}

const sendEmailChangeMail = async (oldEmail, newEmail) => {
  const transporter = createTransport();

  const mailOptions = {
    from: `Akıllı Kova: ${process.env.SMTP_USER}`,
    to: [oldEmail, newEmail],
    subject: 'Akıllı Kova - E-posta Adresi Değişikliği Bilgilendirmesi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              .mail-wrapper { font-family: 'Arial', sans-serif; background-color: #f8f9fa; padding: 40px; text-align: center; }
              .card { max-width: 500px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e1e4e8; text-align: left; }
              .header { color: #2ecc71; font-size: 24px; font-weight: bold; margin-bottom: 20px; text-align: center; }
              .warning { background: #fff3cd; color: #856404; padding: 15px; border-radius: 8px; border: 1px solid #ffeeba; font-size: 14px; margin-bottom: 20px; }
              .info-row { margin-bottom: 15px; font-size: 16px; color: #444; }
              .footer { margin-top: 30px; font-size: 12px; color: #959da5; text-align: center; }
          </style>
      </head>
      <body>
          <div class="mail-wrapper">
              <div class="card">
                  <div class="header">E-posta Adresiniz Değiştirildi</div>
                  <div class="warning">
                      <strong>Uyarı:</strong> Bu işlem sizin tarafınızdan yapılmadıysa lütfen hemen bizimle iletişime geçin.
                  </div>
                  <div class="info-row">
                      <strong>Eski E-posta:</strong> ${oldEmail}
                  </div>
                  <div class="info-row">
                      <strong>Yeni E-posta:</strong> ${newEmail}
                  </div>
                  <p style="color: #666; font-size: 14px; line-height: 1.5;">
                      Hesabınızın güvenliği için bu değişikliği her iki adresinize de bildirdik.
                  </p>
              </div>
              <div class="footer">
                  Akıllı Kova Geri Dönüşüm Sistemi © ${new Date().getFullYear()}
              </div>
          </div>
      </body>
      </html>
    `,
  }

  try {
    await transporter.sendMail(mailOptions);
    return {success: true}
  } catch (err) {
    console.log('E-posta Değişim Maili Hatası: ', err);
    return {success: false, error: err.message}
  }
}

const sendPasswordChangeMail = async (email) => {
  const transporter = createTransport();
  const date = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

  const mailOptions = {
    from: `Akıllı Kova: ${process.env.SMTP_USER}`,
    to: email,
    subject: 'Akıllı Kova - Güvenlik Uyarısı: Şifreniz Değiştirildi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              .mail-wrapper { font-family: 'Arial', sans-serif; background-color: #f8f9fa; padding: 40px; text-align: center; }
              .card { max-width: 500px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e1e4e8; text-align: left; }
              .header { color: #d73a49; font-size: 24px; font-weight: bold; margin-bottom: 20px; text-align: center; }
              .info-box { background: #f6f8fa; padding: 20px; border-radius: 8px; border: 1px solid #e1e4e8; margin-bottom: 20px; }
              .footer { margin-top: 30px; font-size: 12px; color: #959da5; text-align: center; }
          </style>
      </head>
      <body>
          <div class="mail-wrapper">
              <div class="card">
                  <div class="header">Şifre Değişikliği Onayı</div>
                  <p style="font-size: 16px; color: #24292e;">Merhaba,</p>
                  <p style="font-size: 16px; color: #24292e;">Akıllı Kova hesabınızın şifresi başarıyla değiştirildi.</p>
                  
                  <div class="info-box">
                      <div style="margin-bottom: 10px;"><strong>İşlem Zamanı:</strong> ${date}</div>
                      <div><strong>Durum:</strong> Başarılı</div>
                  </div>

                  <p style="color: #666; font-size: 14px; line-height: 1.5;">
                      Bu işlem sizin tarafınızdan yapıldıysa herhangi bir işlem yapmanıza gerek yoktur. Eğer bu işlemi siz yapmadıysanız lütfen şifrenizi sıfırlayın veya destek ekibimize ulaşın.
                  </p>
              </div>
              <div class="footer">
                  Akıllı Kova Geri Dönüşüm Sistemi © ${new Date().getFullYear()}
              </div>
          </div>
      </body>
      </html>
    `,
  }

  try {
    await transporter.sendMail(mailOptions);
    return {success: true}
  } catch (err) {
    console.log('Şifre Değişim Maili Hatası: ', err);
    return {success: false, error: err.message}
  }
}

module.exports = {
  sendVerificationMail,
  sendResetPasswordMail,
  sendWelcomeMail,
  sendEmailChangeMail,
  sendPasswordChangeMail,
  sendEmailChangeVerificationMail
}