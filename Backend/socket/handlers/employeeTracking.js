const {
  applyEmployeeLocationUpdate,
} = require('../../services/employeeLocationService');
const {
  getAllEmployeeLocations,
  markEmployeeOffline,
  startLocationStoreSweep,
} = require('../../services/locationStore');

const ADMIN_ROOM = 'tracking:admin';

function registerEmployeeTracking(io, socket) {
  const { userId, role } = socket.user;

  if (role === 'ADMIN' || role === 'BOSS') {
    socket.join(ADMIN_ROOM);
    socket.emit('location:employees:snapshot', {
      employees: getAllEmployeeLocations(),
    });
    return;
  }

  if (role !== 'EMPLOYEE') {
    return;
  }

  socket.join('role:employee');

  socket.on('location:update', async (payload, ack) => {
    try {
      const result = await applyEmployeeLocationUpdate(userId, payload);

      if (!result.ok) {
        if (result.message) {
          socket.emit('location:error', { message: result.message });
        }
        if (typeof ack === 'function') {
          ack({ ok: false, reason: result.reason });
        }
        return;
      }

      io.to(ADMIN_ROOM).emit('location:employee:update', result.entry);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      console.error('[socket] location:update', err);
      socket.emit('location:error', { message: 'Konum güncellenemedi.' });
      if (typeof ack === 'function') ack({ ok: false });
    }
  });

  socket.on('disconnect', () => {
    markEmployeeOffline(userId);
  });
}

function attachEmployeeTracking(io) {
  startLocationStoreSweep();

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id} (${socket.user?.role})`);
    registerEmployeeTracking(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
    });
  });
}

module.exports = { attachEmployeeTracking, ADMIN_ROOM };
