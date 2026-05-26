const { PrismaClient } = require('@prisma/client');
const { enrichBinWithFullness } = require('./binFullness');
const { findLatestEmptiedAtByBinIds } = require('./binFullnessRepository');
const {
  buildBinLabel,
  FULLNESS_ALERT_THRESHOLD,
} = require('./employeeRegionAlerts');

const prisma = new PrismaClient();

const POLL_INTERVAL_MS = parseInt(
  process.env.FULLNESS_POLL_INTERVAL_MS || '60000',
  10
);
const EMIT_DELTA = parseFloat(process.env.FULLNESS_EMIT_DELTA || '0.01');

const ADMIN_ROOM = 'role:admin';
const cache = new Map();
let pollTimer = null;
let ioRef = null;

function regionRoom(regionId) {
  return `region:${regionId}`;
}

function buildPayload(bin, predictedFullness, previousFullness = null) {
  const fullnessPercent = Math.round(predictedFullness * 100);
  return {
    binId: bin.id,
    regionId: bin.regionId,
    type: bin.type,
    wasteCategory: bin.wasteCategory,
    latitude: bin.latitude,
    longitude: bin.longitude,
    predictedFullness,
    fullnessPercent,
    previousFullness,
    label: buildBinLabel(bin.type, bin.wasteCategory),
    isCritical: predictedFullness >= FULLNESS_ALERT_THRESHOLD,
  };
}

function shouldEmitIncrease(previousFullness, newFullness) {
  if (previousFullness == null) return false;
  if (newFullness > previousFullness + EMIT_DELTA) return true;
  if (previousFullness < FULLNESS_ALERT_THRESHOLD && newFullness >= FULLNESS_ALERT_THRESHOLD) {
    return true;
  }
  return false;
}

function emitToRooms(io, regionId, event, payload) {
  if (regionId) {
    io.to(regionRoom(regionId)).emit(event, payload);
  }
  io.to(ADMIN_ROOM).emit(event, payload);
}

async function loadAllBinsEnriched() {
  const bins = await prisma.bin.findMany({
    where: { regionId: { not: null } },
    select: {
      id: true,
      type: true,
      wasteCategory: true,
      latitude: true,
      longitude: true,
      capacityVolume: true,
      createdAt: true,
      regionId: true,
    },
  });
  if (!bins.length) return [];

  const latestMap = await findLatestEmptiedAtByBinIds(bins.map((b) => b.id));
  const now = new Date();
  return bins.map((bin) =>
    enrichBinWithFullness(bin, latestMap.get(bin.id), now)
  );
}

async function pollAndEmit() {
  if (!ioRef) return;

  try {
    const enriched = await loadAllBinsEnriched();

    for (const bin of enriched) {
      const fullness = bin.predictedFullness ?? 0;
      const prev = cache.get(bin.id);
      const previousFullness = prev?.fullness ?? null;

      if (shouldEmitIncrease(previousFullness, fullness)) {
        const payload = buildPayload(bin, fullness, previousFullness);
        emitToRooms(ioRef, bin.regionId, 'bin:fullness:increased', payload);
      }

      cache.set(bin.id, {
        fullness,
        regionId: bin.regionId,
      });
    }
  } catch (err) {
    console.error('[fullness-broadcast] poll error', err);
  }
}

async function emitBinFullnessUpdated(binId) {
  if (!ioRef) return;

  try {
    const bin = await prisma.bin.findUnique({
      where: { id: binId },
      select: {
        id: true,
        type: true,
        wasteCategory: true,
        latitude: true,
        longitude: true,
        capacityVolume: true,
        createdAt: true,
        regionId: true,
      },
    });
    if (!bin?.regionId) return;

    const latestMap = await findLatestEmptiedAtByBinIds([binId]);
    const enriched = enrichBinWithFullness(bin, latestMap.get(binId), new Date());
    const fullness = enriched.predictedFullness ?? 0;
    const prev = cache.get(binId);
    const previousFullness = prev?.fullness ?? null;

    const payload = buildPayload(enriched, fullness, previousFullness);
    emitToRooms(ioRef, bin.regionId, 'bin:fullness:updated', payload);

    cache.set(binId, { fullness, regionId: bin.regionId });
  } catch (err) {
    console.error('[fullness-broadcast] emitBinFullnessUpdated', err);
  }
}

async function getRegionSnapshot(regionId) {
  const bins = await prisma.bin.findMany({
    where: { regionId },
    select: {
      id: true,
      type: true,
      wasteCategory: true,
      latitude: true,
      longitude: true,
      capacityVolume: true,
      createdAt: true,
      regionId: true,
    },
  });
  if (!bins.length) return [];

  const latestMap = await findLatestEmptiedAtByBinIds(bins.map((b) => b.id));
  const now = new Date();
  return bins.map((bin) => {
    const enriched = enrichBinWithFullness(bin, latestMap.get(bin.id), now);
    return buildPayload(enriched, enriched.predictedFullness ?? 0, null);
  });
}

function startFullnessBroadcast(io) {
  ioRef = io;
  if (pollTimer) clearInterval(pollTimer);

  pollAndEmit();
  pollTimer = setInterval(pollAndEmit, POLL_INTERVAL_MS);
}

function stopFullnessBroadcast() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

module.exports = {
  ADMIN_ROOM,
  regionRoom,
  buildPayload,
  shouldEmitIncrease,
  pollAndEmit,
  emitBinFullnessUpdated,
  getRegionSnapshot,
  startFullnessBroadcast,
  stopFullnessBroadcast,
  EMIT_DELTA,
};
