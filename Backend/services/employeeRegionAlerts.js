const { PrismaClient } = require('@prisma/client');
const { enrichBinWithFullness, toFullnessPercent } = require('./binFullness');
const { findLatestEmptiedAtByBinIds } = require('./binFullnessRepository');

const prisma = new PrismaClient();

const FULLNESS_ALERT_THRESHOLD = 0.8;

const BIN_TYPE_LABELS = {
  CONTAINER_SMALL: 'Küçük konteyner',
  CONTAINER_LARGE: 'Büyük konteyner',
  WASTE_POINT: 'Atık noktası',
};

const WASTE_CATEGORY_LABELS = {
  DOMESTIC: 'Evsel atık',
  PLASTIC: 'Plastik atık',
  GLASS: 'Cam atık',
  PAPER: 'Kağıt atık',
  ELECTRONIC: 'Elektronik atık',
  GENERAL: 'Genel atık',
};

function buildBinLabel(type, wasteCategory) {
  const typeLabel = BIN_TYPE_LABELS[type] || type;
  if (type === 'WASTE_POINT') {
    const categoryLabel = WASTE_CATEGORY_LABELS[wasteCategory] || wasteCategory;
    return `${typeLabel} — ${categoryLabel}`;
  }
  return typeLabel;
}

function mapBinToAlert(bin) {
  const fullnessPercent = toFullnessPercent(bin.predictedFullness);
  return {
    id: bin.id,
    type: bin.type,
    wasteCategory: bin.wasteCategory,
    predictedFullness: bin.predictedFullness,
    fullnessPercent,
    latitude: bin.latitude,
    longitude: bin.longitude,
    label: buildBinLabel(bin.type, bin.wasteCategory),
  };
}

function filterAndSortAlerts(enrichedBins, threshold = FULLNESS_ALERT_THRESHOLD) {
  return enrichedBins
    .filter((bin) => (bin.predictedFullness ?? 0) >= threshold)
    .sort((a, b) => (b.predictedFullness ?? 0) - (a.predictedFullness ?? 0))
    .map(mapBinToAlert);
}

async function enrichBinsReadOnly(bins) {
  if (!bins.length) return [];

  const binIds = bins.map((b) => b.id);
  const latestMap = await findLatestEmptiedAtByBinIds(binIds);
  const now = new Date();

  return bins.map((bin) => enrichBinWithFullness(bin, latestMap.get(bin.id), now));
}

async function getRegionFullnessAlerts(userId) {
  const employee = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      regionId: true,
      region: {
        select: { name: true },
      },
    },
  });

  if (!employee?.regionId) {
    return {
      needsRegionSelection: true,
      regionName: null,
      alerts: [],
    };
  }

  const bins = await prisma.bin.findMany({
    where: { regionId: employee.regionId },
    select: {
      id: true,
      type: true,
      wasteCategory: true,
      latitude: true,
      longitude: true,
      capacityVolume: true,
      createdAt: true,
      predictedFullness: true,
    },
  });

  const enriched = await enrichBinsReadOnly(bins);
  const alerts = filterAndSortAlerts(enriched);

  return {
    needsRegionSelection: false,
    regionName: employee.region?.name || null,
    alerts,
  };
}

module.exports = {
  FULLNESS_ALERT_THRESHOLD,
  BIN_TYPE_LABELS,
  WASTE_CATEGORY_LABELS,
  buildBinLabel,
  mapBinToAlert,
  filterAndSortAlerts,
  enrichBinsReadOnly,
  getRegionFullnessAlerts,
};
