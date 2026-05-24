const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Querying all WasteRequest records in the DB...');
  const requests = await prisma.wasteRequest.findMany({
    include: {
      user: true
    }
  });
  console.log(`Found ${requests.length} request(s):`);
  console.log(JSON.stringify(requests, null, 2));
}

main()
  .catch(e => {
    console.error('Error during query:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
