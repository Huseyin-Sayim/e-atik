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
          legacyEnum: true,
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
    const mapRequestsForLegacyMobile = (reqs) => {
      return reqs.map(req => {
        const mapped = { ...req };
        if (mapped.wasteType && typeof mapped.wasteType === 'object') {
          mapped.wasteTypeDetails = mapped.wasteType;
          mapped.wasteType = mapped.wasteType.legacyEnum || 'DOMESTIC';
        }
        return mapped;
      });
    };
    console.log("Mapped first request wasteType:", mapRequestsForLegacyMobile(requests)[0].wasteType);
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
