const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const WASTE_CATEGORIES = [
  'DOMESTIC',
  'PLASTIC',
  'GLASS',
  'PAPER',
  'ELECTRONIC',
  'GENERAL',
];

const WASTE_CATEGORY_LABELS = {
  DOMESTIC: 'Evsel atık',
  PLASTIC: 'Plastik',
  GLASS: 'Cam',
  PAPER: 'Kağıt',
  ELECTRONIC: 'Elektronik',
  GENERAL: 'Genel',
};

const WASTE_CATEGORY_ICONS = {
  DOMESTIC: '/assets/images/map/waste-domestic.svg',
  PLASTIC: '/assets/images/map/waste-plastic.svg',
  GLASS: '/assets/images/map/waste-glass.svg',
  PAPER: '/assets/images/map/waste-paper.svg',
  ELECTRONIC: '/assets/images/map/waste-electronic.svg',
  GENERAL: '/assets/images/map/waste-general.svg',
};

function emptyTotals() {
  return WASTE_CATEGORIES.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
}

function formatLiters(liters) {
  const value = Number(liters);
  if (!Number.isFinite(value) || value <= 0) {
    return '0 L';
  }
  const rounded = Math.round(value * 10) / 10;
  const formatted = rounded.toLocaleString('tr-TR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 1,
  });
  return `${formatted} L`;
}

function aggregateFromCollectionLogs(logs) {
  const totals = emptyTotals();

  for (const log of logs) {
    if (!log.bin) continue;
    const category = log.bin.wasteCategory;
    if (!Object.hasOwn(totals, category)) continue;

    const fullness = Number(log.actualFullness);
    const capacity = Number(log.bin.capacityVolume);
    if (!Number.isFinite(fullness) || !Number.isFinite(capacity) || capacity <= 0) {
      continue;
    }

    const collectedLiters = Math.max(0, fullness) * capacity;
    totals[category] += collectedLiters;
  }

  return totals;
}

/**
 * İleride WasteRequest COLLECTED + weight buraya eklenecek.
 * @param {import('@prisma/client').PrismaClient} [db]
 */
async function getRecyclingTotalsByCategory(db = prisma) {
  const logs = await db.collectionLog.findMany({
    select: {
      actualFullness: true,
      bin: {
        select: {
          wasteCategory: true,
          capacityVolume: true,
        },
      },
    },
  });

  return aggregateFromCollectionLogs(logs);
}

async function getRecyclingStatsForDashboard(db = prisma) {
  const totals = await getRecyclingTotalsByCategory(db);

  return WASTE_CATEGORIES.map((key) => {
    const liters = totals[key] ?? 0;
    return {
      key,
      label: WASTE_CATEGORY_LABELS[key],
      iconUrl: WASTE_CATEGORY_ICONS[key],
      liters,
      formatted: formatLiters(liters),
    };
  });
}

module.exports = {
  WASTE_CATEGORIES,
  WASTE_CATEGORY_LABELS,
  WASTE_CATEGORY_ICONS,
  emptyTotals,
  formatLiters,
  aggregateFromCollectionLogs,
  getRecyclingTotalsByCategory,
  getRecyclingStatsForDashboard,
};
