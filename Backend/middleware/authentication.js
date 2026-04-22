const jwt = require('jsonwebtoken');

const isAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies.accessToken;

  if (!token) return res.status(401).json({message: 'Giriş yapınız'});

  try {
    req.user = jwt.verify(token, process.env.ACCESS_SECRET_KEY);
    next();
  } catch (err) {
    return res.status(401).json({message: 'Token geçersiz!'});
  }
};

module.exports = isAuth;