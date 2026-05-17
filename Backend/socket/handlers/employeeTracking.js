const { PrismaClient } = require('@prisma/client');
const { assertPointInCampus } = require('../../services/campusParcels');
const {
  setEmployeeLocation,
  getAllEmployeeLocations,
  removeEmployee,
  startLocationStoreSweep,
} = require('../../services/locationStore');

const prisma = new PrismaClient();

const ADMIN_ROOM = 'tracking:admin';

function isValidCoordinate(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function registerEmployeeTracking(io, socket) {
  const { userId, role } = socket.user;

  if (role === 'ADMIN') {
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
      const latitude = Number(payload?.latitude);
      const longitude = Number(payload?.longitude);
      const accuracy =
        payload?.accuracy != null ? Number(payload.accuracy) : null;

      if (!isValidCoordinate(latitude, longitude)) {
        socket.emit('location:error', { message: 'Geçersiz koordinat.' });
        if (typeof ack === 'function') ack({ ok: false });
        return;
      }

      const campus = assertPointInCampus(latitude, longitude);
      if (!campus.ok) {
        socket.emit('location:error', { message: campus.message });
        if (typeof ack === 'function') ack({ ok: false });
        return;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, role: true },
      });

      if (!dbUser || dbUser.role !== 'EMPLOYEE') {
        socket.emit('location:error', { message: 'Yetkisiz.' });
        if (typeof ack === 'function') ack({ ok: false });
        return;
      }

      const result = setEmployeeLocation(userId, {
        latitude,
        longitude,
        accuracy,
        name: dbUser.name,
        role: dbUser.role,
      });

      if (!result.accepted) {
        if (typeof ack === 'function') ack({ ok: false, reason: result.reason });
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
    removeEmployee(userId);
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
