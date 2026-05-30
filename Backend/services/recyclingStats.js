const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const WASTE_CATEGORY_ICONS = {
  DOMESTIC: '/assets/images/map/waste-domestic.svg',
  PLASTIC: '/assets/images/map/waste-plastic.svg',
  GLASS: '/assets/images/map/waste-glass.svg',
  PAPER: '/assets/images/map/waste-paper.svg',
  ELECTRONIC: '/assets/images/map/waste-electronic.svg',
  GENERAL: '/assets/images/map/waste-general.svg',
};

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

function formatKg(kg) {
  const value = Number(kg);
  if (!Number.isFinite(value) || value <= 0) {
    return '0 kg';
  }
  const rounded = Math.round(value * 10) / 10;
  const formatted = rounded.toLocaleString('tr-TR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 1,
  });
  return `${formatted} kg`;
}

function iconForParent(parent) {
  if (parent.legacyEnum && WASTE_CATEGORY_ICONS[parent.legacyEnum]) {
    return WASTE_CATEGORY_ICONS[parent.legacyEnum];
  }
  return WASTE_CATEGORY_ICONS.GENERAL;
}

function aggregateBinLitersByParentId(logs, enumToParentId) {
  const litersByParentId = {};

  for (const log of logs) {
    if (!log.bin) continue;
    const parentId = enumToParentId[log.bin.wasteCategory];
    if (!parentId) continue;

    const fullness = Number(log.actualFullness);
    const capacity = Number(log.bin.capacityVolume);
    if (!Number.isFinite(fullness) || !Number.isFinite(capacity) || capacity <= 0) {
      continue;
    }

    const collectedLiters = Math.max(0, fullness) * capacity;
    litersByParentId[parentId] = (litersByParentId[parentId] || 0) + collectedLiters;
  }

  return litersByParentId;
}

function aggregateCollectedRequests(requests) {
  const byChildId = {};

  for (const req of requests) {
    const childId = req.wasteTypeId;
    if (!childId) continue;

    if (!byChildId[childId]) {
      byChildId[childId] = {
        collectionCount: 0,
        totalWeightKg: 0,
        totalCoins: 0,
      };
    }

    byChildId[childId].collectionCount += 1;
    const weight = Number(req.weight);
    if (Number.isFinite(weight) && weight > 0) {
      byChildId[childId].totalWeightKg += weight;
    }
    const coins = Number(req.earnedCoins);
    if (Number.isFinite(coins) && coins > 0) {
      byChildId[childId].totalCoins += coins;
    }
  }

  return byChildId;
}

async function getRecyclingStatsForDashboard(db = prisma, { userId = null } = {}) {
  const parents = await db.wasteType.findMany({
    where: { parentId: null, isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  const enumToParentId = {};
  for (const parent of parents) {
    if (parent.legacyEnum) {
      enumToParentId[parent.legacyEnum] = parent.id;
    }
  }

  const [logs, collectedRequests] = await Promise.all([
    db.collectionLog.findMany({
      select: {
        actualFullness: true,
        bin: {
          select: {
            wasteCategory: true,
            capacityVolume: true,
          },
        },
      },
    }),
    db.wasteRequest.findMany({
      where: {
        status: 'COLLECTED',
        ...(userId ? { userId } : {}),
      },
      select: {
        wasteTypeId: true,
        weight: true,
        earnedCoins: true,
      },
    }),
  ]);

  const litersByParentId = aggregateBinLitersByParentId(logs, enumToParentId);
  const requestStatsByChildId = aggregateCollectedRequests(collectedRequests);

  return parents.map((parent) => {
    const liters = litersByParentId[parent.id] ?? 0;

    const children = (parent.children || []).map((child) => {
      const stats = requestStatsByChildId[child.id] || {
        collectionCount: 0,
        totalWeightKg: 0,
        totalCoins: 0,
      };
      return {
        id: child.id,
        name: child.name,
        slug: child.slug,
        coinRewardMode: child.coinRewardMode,
        coinRewardValue: child.coinRewardValue,
        collectionCount: stats.collectionCount,
        totalWeightKg: stats.totalWeightKg,
        totalCoins: stats.totalCoins,
        formattedWeight: formatKg(stats.totalWeightKg),
      };
    });

    const parentRequestTotals = children.reduce(
      (acc, child) => {
        acc.collectionCount += child.collectionCount;
        acc.totalWeightKg += child.totalWeightKg;
        acc.totalCoins += child.totalCoins;
        return acc;
      },
      { collectionCount: 0, totalWeightKg: 0, totalCoins: 0 }
    );

    return {
      id: parent.id,
      slug: parent.slug,
      label: parent.name,
      iconUrl: iconForParent(parent),
      liters,
      formatted: formatLiters(liters),
      children,
      collectionCount: parentRequestTotals.collectionCount,
      totalWeightKg: parentRequestTotals.totalWeightKg,
      totalCoins: parentRequestTotals.totalCoins,
      formattedWeight: formatKg(parentRequestTotals.totalWeightKg),
    };
  });
}

/** @deprecated bin enum aggregation — tests only */
const WASTE_CATEGORIES = [
  'DOMESTIC',
  'PLASTIC',
  'GLASS',
  'PAPER',
  'ELECTRONIC',
  'GENERAL',
];

function emptyTotals() {
  return WASTE_CATEGORIES.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
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
    totals[category] += Math.max(0, fullness) * capacity;
  }
  return totals;
}

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

module.exports = {
  WASTE_CATEGORIES,
  emptyTotals,
  formatLiters,
  formatKg,
  aggregateFromCollectionLogs,
  getRecyclingTotalsByCategory,
  getRecyclingStatsForDashboard,
};
