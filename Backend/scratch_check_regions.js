const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const regions = await prisma.region.findMany();
  console.log("=== DB REGIONS ===");
  console.log(JSON.stringify(regions, null, 2));

  const users = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    select: { id: true, email: true, name: true, role: true, regionId: true }
  });
  console.log("=== EMPLOYEE USERS ===");
  console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
