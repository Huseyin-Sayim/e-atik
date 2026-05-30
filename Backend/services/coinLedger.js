const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function ensureWallet(userId, tx = prisma) {
  return tx.wallet.upsert({
    where: { userId },
    create: { userId, balance: 0 },
    update: {},
  });
}

async function creditCoins(userId, amount, { description, type = 'EARNED', tx } = {}) {
  const coins = Math.round(Number(amount));
  if (!userId || coins <= 0) return null;

  const run = async (client) => {
    await ensureWallet(userId, client);
    const wallet = await client.wallet.update({
      where: { userId },
      data: { balance: { increment: coins } },
    });
    await client.transaction.create({
      data: {
        userId,
        amount: coins,
        type,
        description: description || null,
      },
    });
    return wallet;
  };

  if (tx) return run(tx);
  return prisma.$transaction(run);
}

async function getWalletBalance(userId) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { balance: true },
  });
  return wallet?.balance ?? 0;
}

module.exports = {
  ensureWallet,
  creditCoins,
  getWalletBalance,
};
