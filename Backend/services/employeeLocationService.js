const { PrismaClient } = require('@prisma/client');
const { assertPointInCampus } = require('./campusParcels');
const { isValidCoordinate, setEmployeeLocation } = require('./locationStore');

const prisma = new PrismaClient();

const PARCEL_LABELS = {
  akademik: 'Ege Üniversitesi Akademik ve Sosyal Yerleşke',
  hastane: 'Ege Üniversitesi Hastane Kompleksi',
  kyk: 'Ege Üniversitesi Spor ve Giriş Hattı',
};

let resolveEmployeeUser = defaultResolveEmployeeUser;

async function defaultResolveEmployeeUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, role: true },
  });
}

function parcelLabelForKey(parcelKey) {
  if (!parcelKey) return null;
  return PARCEL_LABELS[parcelKey] || parcelKey;
}

function setEmployeeUserResolverForTests(fn) {
  resolveEmployeeUser = fn;
}

function resetEmployeeUserResolverForTests() {
  resolveEmployeeUser = defaultResolveEmployeeUser;
}

/**
 * Çalışan konum güncellemesi (Socket ve REST ortak mantık).
 * @returns {{ ok: true, entry }} | {{ ok: false, reason, message? }}
 */
async function applyEmployeeLocationUpdate(userId, payload) {
  const latitude = Number(payload?.latitude);
  const longitude = Number(payload?.longitude);
  const accuracy = payload?.accuracy != null ? Number(payload.accuracy) : null;

  if (!isValidCoordinate(latitude, longitude)) {
    return {
      ok: false,
      reason: 'invalid_coordinates',
      message: 'Geçersiz koordinat.',
    };
  }

  const campus = assertPointInCampus(latitude, longitude);
  if (!campus.ok) {
    return {
      ok: false,
      reason: 'outside_campus',
      message: campus.message,
    };
  }

  const dbUser = await resolveEmployeeUser(userId);
  if (!dbUser || dbUser.role !== 'EMPLOYEE') {
    return {
      ok: false,
      reason: 'unauthorized',
      message: 'Yetkisiz.',
    };
  }

  const parcelLabel = parcelLabelForKey(campus.parcelKey);
  const result = setEmployeeLocation(userId, {
    latitude,
    longitude,
    accuracy,
    name: dbUser.name,
    role: dbUser.role,
    parcelKey: campus.parcelKey,
    parcelLabel,
  });

  if (!result.accepted) {
    return {
      ok: false,
      reason: result.reason,
      message:
        result.reason === 'throttled'
          ? 'Konum güncellemesi çok sık.'
          : 'Konum kaydedilemedi.',
    };
  }

  return { ok: true, entry: result.entry };
}

module.exports = {
  PARCEL_LABELS,
  parcelLabelForKey,
  applyEmployeeLocationUpdate,
  setEmployeeUserResolverForTests,
  resetEmployeeUserResolverForTests,
};
