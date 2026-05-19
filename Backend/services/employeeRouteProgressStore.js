const store = new Map();

function setEmployeeRouteProgress(userId, payload) {
  const currentStep = Number(payload?.currentStep);
  const completedCount = Number(payload?.completedCount);

  if (!userId || !Number.isFinite(currentStep) || currentStep < 0) {
    return { ok: false, reason: 'invalid_current_step' };
  }

  const entry = {
    currentStep: Math.floor(currentStep),
    completedCount: Number.isFinite(completedCount) && completedCount >= 0
      ? Math.floor(completedCount)
      : 0,
    regionParcelId: payload?.regionParcelId || null,
    updatedAt: new Date().toISOString(),
  };

  store.set(userId, entry);
  return { ok: true, entry };
}

function getEmployeeRouteProgress(userId) {
  return store.get(userId) || null;
}

function resetEmployeeRouteProgressForTests() {
  store.clear();
}

module.exports = {
  setEmployeeRouteProgress,
  getEmployeeRouteProgress,
  resetEmployeeRouteProgressForTests,
};
