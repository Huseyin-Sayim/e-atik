const MS_PER_HOUR = 60 * 60 * 1000;

const BASE_HOURS_PER_100L = {
  CONTAINER_SMALL: 24,
  CONTAINER_LARGE: 24,
  WASTE_POINT: 48,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getBaseHoursFor100L(binType) {
  return BASE_HOURS_PER_100L[binType] ?? BASE_HOURS_PER_100L.CONTAINER_SMALL;
}

function getHoursToFull(binType, capacityVolume) {
  const capacity = Number(capacityVolume);
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return BASE_HOURS_PER_100L.CONTAINER_SMALL;
  }
  const baseHours = getBaseHoursFor100L(binType);
  return (capacity / 100) * baseHours;
}

function getLastEmptiedAt(bin, latestLogEmptiedAt) {
  if (latestLogEmptiedAt) {
    return latestLogEmptiedAt instanceof Date
      ? latestLogEmptiedAt
      : new Date(latestLogEmptiedAt);
  }
  if (bin.createdAt) {
    return bin.createdAt instanceof Date ? bin.createdAt : new Date(bin.createdAt);
  }
  return new Date();
}

function calculatePredictedFullness(bin, lastEmptiedAt, now = new Date()) {
  const emptied =
    lastEmptiedAt instanceof Date ? lastEmptiedAt : new Date(lastEmptiedAt);
  const reference = now instanceof Date ? now : new Date(now);
  const hoursToFull = getHoursToFull(bin.type, bin.capacityVolume);

  if (hoursToFull <= 0) {
    return 0;
  }

  const elapsedMs = reference.getTime() - emptied.getTime();
  const elapsedHours = Math.max(0, elapsedMs / MS_PER_HOUR);
  const ratio = elapsedHours / hoursToFull;

  return clamp(ratio, 0, 1);
}

function enrichBinWithFullness(bin, latestLogEmptiedAt, now = new Date()) {
  const lastEmptiedAt = getLastEmptiedAt(bin, latestLogEmptiedAt);
  const hoursToFull = getHoursToFull(bin.type, bin.capacityVolume);
  const predictedFullness = calculatePredictedFullness(bin, lastEmptiedAt, now);

  return {
    ...bin,
    predictedFullness,
    lastEmptiedAt: lastEmptiedAt.toISOString(),
    hoursToFull,
  };
}

module.exports = {
  BASE_HOURS_PER_100L,
  getBaseHoursFor100L,
  getHoursToFull,
  getLastEmptiedAt,
  calculatePredictedFullness,
  enrichBinWithFullness,
};
