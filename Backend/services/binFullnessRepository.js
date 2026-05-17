const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * @param {string[]} binIds
 * @returns {Promise<Map<string, Date>>}
 */
async function findLatestEmptiedAtByBinIds(binIds) {
  const map = new Map();
  if (!binIds.length) {
    return map;
  }

  const logs = await prisma.collectionLog.findMany({
    where: { binId: { in: binIds } },
    orderBy: { emptiedAt: 'desc' },
    select: { binId: true, emptiedAt: true },
  });

  for (const log of logs) {
    if (!map.has(log.binId)) {
      map.set(log.binId, log.emptiedAt);
    }
  }

  return map;
}

module.exports = {
  findLatestEmptiedAtByBinIds,
};
