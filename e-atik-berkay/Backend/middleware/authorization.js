const jwt = require('jsonwebtoken');

const hasRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({message: 'Giriş yapınız!'});

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({message: 'Yetkisiz erişim!'});
    }

    next();
  };
};

module.exports = hasRole;