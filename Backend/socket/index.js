const { Server } = require('socket.io');
const { socketAuth } = require('./middleware/auth');
const { attachEmployeeTracking } = require('./handlers/employeeTracking');
const { attachBinFullness } = require('./handlers/binFullness');
const { startFullnessBroadcast } = require('../services/binFullnessBroadcast');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  socketAuth(io);
  attachEmployeeTracking(io);
  attachBinFullness(io);
  startFullnessBroadcast(io);

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io henüz başlatılmadı.');
  }
  return io;
}

module.exports = {
  initSocket,
  getIO,
};
