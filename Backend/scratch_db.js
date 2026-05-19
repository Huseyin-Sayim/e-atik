const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const requests = await prisma.wasteRequest.findMany({
    include: {
      user: true
    }
  });
  console.log("=== TÜM EVSEL ATIK TALEPLERİ ===");
  console.log(JSON.stringify(requests, null, 2));

  const bins = await prisma.bin.findMany();
  console.log("=== TÜM ÇÖP KUTULARI ===");
  console.log(JSON.stringify(bins, null, 2));
}

main().catch(err => {
  console.error(err);
}).finally(async () => {
  await prisma.$disconnect();
});
