const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const requests = await prisma.wasteRequest.findMany({
    include: {
      user: true
    }
  });
  console.log("TOTAL REQUESTS:", requests.length);
  requests.forEach(r => {
    console.log(`ID: ${r.id} | User: ${r.user?.name} | Type: ${r.wasteType} | Status: ${r.status} | Lat: ${r.latitude} | Lng: ${r.longitude}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
