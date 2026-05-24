const { PrismaClient } = require('@prisma/client');
const {
  ADMIN_ROOM,
  regionRoom,
  getRegionSnapshot,
} = require('../../services/binFullnessBroadcast');

const prisma = new PrismaClient();

async function joinFullnessRooms(socket) {
  const { userId, role } = socket.user;

  if (role === 'ADMIN') {
    socket.join(ADMIN_ROOM);
    return;
  }

  if (role !== 'EMPLOYEE') {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { regionId: true },
  });

  if (!user?.regionId) {
    return;
  }

  socket.data.regionId = user.regionId;
  socket.join(regionRoom(user.regionId));

  const bins = await getRegionSnapshot(user.regionId);
  socket.emit('bin:fullness:snapshot', {
    regionId: user.regionId,
    bins,
  });
}

function registerBinFullness(socket) {
  socket.on('fullness:subscribe', async (payload, ack) => {
    try {
      if (socket.user.role !== 'EMPLOYEE') {
        if (typeof ack === 'function') ack({ ok: false, message: 'Yetkisiz.' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: socket.user.userId },
        select: { regionId: true },
      });

      const requestedRegionId = payload?.regionId;
      if (!user?.regionId || user.regionId !== requestedRegionId) {
        if (typeof ack === 'function') ack({ ok: false, message: 'Bölge yetkisi yok.' });
        return;
      }

      socket.join(regionRoom(user.regionId));
      const bins = await getRegionSnapshot(user.regionId);
      socket.emit('bin:fullness:snapshot', { regionId: user.regionId, bins });
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      console.error('[socket] fullness:subscribe', err);
      if (typeof ack === 'function') ack({ ok: false });
    }
  });
}

function attachBinFullness(io) {
  io.on('connection', (socket) => {
    joinFullnessRooms(socket).catch((err) => {
      console.error('[socket] joinFullnessRooms', err);
    });
    registerBinFullness(socket);
  });
}

module.exports = { attachBinFullness, joinFullnessRooms };
