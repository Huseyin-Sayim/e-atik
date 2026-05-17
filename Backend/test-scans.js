const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const scans = await prisma.scannedQRCode.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log('--- SCANNED CODES ---');
  console.log(JSON.stringify(scans, null, 2));
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
