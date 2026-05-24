const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const bins = await prisma.bin.findMany();
  console.log('Bins in DB:', JSON.stringify(bins, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
