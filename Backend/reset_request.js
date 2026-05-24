const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.wasteRequest.updateMany({
    where: {
      status: 'COLLECTED'
    },
    data: {
      status: 'PENDING'
    }
  });
  console.log(`RESET SUCCESSFUL! Updated ${updated.count} requests back to 'PENDING'.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
