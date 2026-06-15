const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const requests = await prisma.wasteRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      wasteType: {
        select: {
          id: true,
          name: true,
          slug: true,
          coinRewardMode: true,
          coinRewardValue: true,
          parent: { select: { id: true, name: true } },
        },
      },
      user: {
        select: { id: true, name: true, email: true, phoneNumber: true },
      },
    },
  });
  console.log("Waste Requests Count:", requests.length);
  if (requests.length > 0) {
    console.log("First request:", JSON.stringify(requests[0], null, 2));
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
