const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const wasteTypeSelect = {
  id: true,
  slug: true,
  name: true,
  parentId: true,
  coinRewardMode: true,
  coinRewardValue: true,
  isActive: true,
  sortOrder: true,
};

async function getWasteTypeTree({ activeOnly = true, includeInactive = false } = {}) {
  const where = { parentId: null };
  if (activeOnly && !includeInactive) {
    where.isActive = true;
  }

  const parents = await prisma.wasteType.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
    include: {
      children: {
        where: activeOnly && !includeInactive ? { isActive: true } : undefined,
        orderBy: { sortOrder: 'asc' },
        select: wasteTypeSelect,
      },
    },
  });

  return parents.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    sortOrder: p.sortOrder,
    isActive: p.isActive,
    children: p.children,
  }));
}

async function getLeafById(id) {
  return prisma.wasteType.findFirst({
    where: {
      id,
      parentId: { not: null },
      isActive: true,
    },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
    },
  });
}

async function validateLeafWasteTypeId(wasteTypeId) {
  const leaf = await getLeafById(wasteTypeId);
  if (!leaf) {
    return { ok: false, message: 'Geçersiz veya pasif atık türü seçimi.' };
  }
  return { ok: true, leaf };
}

function calculateEarnedCoins(wasteType, weight) {
  if (!wasteType || wasteType.coinRewardValue <= 0) return 0;
  if (wasteType.coinRewardMode === 'PER_KG') {
    const kg = weight != null && weight > 0 ? weight : 0;
    return Math.round(kg * wasteType.coinRewardValue);
  }
  return wasteType.coinRewardValue;
}

function formatCoinRewardLabel(wasteType) {
  if (!wasteType) return '';
  if (wasteType.coinRewardMode === 'PER_KG') {
    return `kg başına ${wasteType.coinRewardValue} coin`;
  }
  return `${wasteType.coinRewardValue} coin`;
}

module.exports = {
  wasteTypeSelect,
  getWasteTypeTree,
  getLeafById,
  validateLeafWasteTypeId,
  calculateEarnedCoins,
  formatCoinRewardLabel,
};
