const jwt = require('jsonwebtoken');

function socketAuth(io) {
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Kimlik doğrulama gerekli.'));
    }

    try {
      const payload = jwt.verify(token, process.env.ACCESS_SECRET_KEY);
      socket.user = {
        userId: payload.userId,
        role: payload.role,
      };
      next();
    } catch {
      next(new Error('Geçersiz veya süresi dolmuş token.'));
    }
  });
}

module.exports = { socketAuth };
