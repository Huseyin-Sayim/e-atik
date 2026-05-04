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
    from: `Akilli Kova: ${process.env.SMTP_USER}`,
    to: email,
    subject: 'Email Adresi Doğrulama ',
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
                  <div class="logo">eAtik</div>
                  <p style="color: #24292e; font-weight: 600;">Hesap Doğrulama</p>
                  <p class="code-text">Hesabınızı onaylamak için aşağıdaki kodu kullanın:</p>
                  
                  <div class="code">${code}</div>
                  
                  <p style="font-size: 13px; color: #d73a49;">Bu kod 5 dakika boyunca geçerlidir.</p>
              </div>
              <div class="footer">
                  eAtik Geri Dönüşüm Sistemi © ${new Date().getFullYear()}
              </div>
          </div>
      </body>
      </html>
    `,
  }

  // TRY CATCH BLOGUNU API İÇİN TEKRAR DÜZENLE

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    return {success: true, messageId: info.messageId}
  } catch (err) {
    console.log('Mail Gönderme Hatası: ' , err)
    throw err;
  }
}

const sendResetPasswordMail = async (email, token) => {
  const transporter = createTransport();
  const verificationLink = process.env.BASE_URL;

  const mailOptions = {
    from: `Akilli Kova: ${process.env.SMTP_USER}`,
    to: email,
    secure: process.env.SMTP_SECURE === "true",
    subject: 'Şifre sıfırlama',
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
                  <div class="logo">eAtik</div>
                  <p style="color: #24292e; font-weight: 600;">Şifre Sıfırlama</p>
                  <p class="code-text">Şifre sıfırlamak için linke tıklayınız</p>
                  
                  <div class="code">
                    <a href="${verificationLink}/reset/password/${token}">${verificationLink}</a>
                  </div>
                  
                  <p style="font-size: 13px; color: #d73a49;">Bu link 5 dakika boyunca geçerlidir.</p>
              </div>
              <div class="footer">
                  eAtik Geri Dönüşüm Sistemi © ${new Date().getFullYear()}
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

module.exports = {
  sendVerificationMail,
  sendResetPasswordMail
}