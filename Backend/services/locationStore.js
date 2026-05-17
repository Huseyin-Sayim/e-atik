const STALE_MS = 5 * 60 * 1000;
const THROTTLE_MS = 5 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

const store = new Map();
const lastUpdateAt = new Map();

let sweepTimer = null;

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

function setEmployeeLocation(userId, payload) {
  const now = Date.now();
  const prev = lastUpdateAt.get(userId) || 0;
  if (now - prev < THROTTLE_MS) {
    return { accepted: false, reason: 'throttled' };
  }

  const { latitude, longitude, accuracy, name, role } = payload;
  if (!isValidCoordinate(latitude, longitude)) {
    return { accepted: false, reason: 'invalid_coordinates' };
  }

  const entry = {
    userId,
    name: name || 'Çalışan',
    role: role || 'EMPLOYEE',
    latitude,
    longitude,
    accuracy: accuracy != null ? Number(accuracy) : null,
    updatedAt: new Date(now).toISOString(),
  };

  store.set(userId, entry);
  lastUpdateAt.set(userId, now);
  return { accepted: true, entry };
}

function getEmployeeLocation(userId) {
  const entry = store.get(userId);
  if (!entry) return null;
  const updated = new Date(entry.updatedAt).getTime();
  if (Date.now() - updated > STALE_MS) {
    store.delete(userId);
    lastUpdateAt.delete(userId);
    return null;
  }
  return entry;
}

function getAllEmployeeLocations() {
  purgeStale();
  return Array.from(store.values()).filter((e) => e.role === 'EMPLOYEE');
}

function removeEmployee(userId) {
  store.delete(userId);
  lastUpdateAt.delete(userId);
}

function purgeStale() {
  const now = Date.now();
  for (const [userId, entry] of store.entries()) {
    const updated = new Date(entry.updatedAt).getTime();
    if (now - updated > STALE_MS) {
      store.delete(userId);
      lastUpdateAt.delete(userId);
    }
  }
}

function startLocationStoreSweep() {
  if (sweepTimer) return;
  sweepTimer = setInterval(purgeStale, SWEEP_INTERVAL_MS);
  if (sweepTimer.unref) sweepTimer.unref();
}

function stopLocationStoreSweep() {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

function resetLocationStoreForTests() {
  store.clear();
  lastUpdateAt.clear();
}

module.exports = {
  STALE_MS,
  THROTTLE_MS,
  setEmployeeLocation,
  getEmployeeLocation,
  getAllEmployeeLocations,
  removeEmployee,
  purgeStale,
  startLocationStoreSweep,
  stopLocationStoreSweep,
  resetLocationStoreForTests,
};
