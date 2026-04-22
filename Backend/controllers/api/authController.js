const {PrismaClient, Prisma} = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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
        experiedAt: new Date(Date().now() + 7 * 24 * 60 * 60 * 1000)
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
      message: 'giriş başarısız'
    })
  }
}

module.exports = {
  register,
  login
}