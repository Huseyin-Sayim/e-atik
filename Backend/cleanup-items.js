const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  try {
    const items = await prisma.wasteItem.findMany();
    console.log(`Total items in DB: ${items.length}`);
    
    // We only expect 16 items. If there are more, we just delete them all and the server will reseed exactly 16 on the next request.
    if (items.length > 16) {
      console.log('Duplicates found! Deleting all items to trigger a clean reseed...');
      await prisma.wasteItem.deleteMany();
      console.log('Cleanup complete. The items will be freshly seeded on the next page refresh.');
    } else {
      console.log('No duplicates found.');
    }
  } catch (error) {
    console.error('Error during cleanup:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
