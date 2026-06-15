const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, profileType: true },
    take: 10
  });
  console.log('=== KULLANICILAR ===');
  users.forEach(u => console.log(u.email, '| role:', u.role, '| profileType:', u.profileType || 'NULL'));
  
  const requests = await prisma.wasteRequest.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, wasteTypeId: true, userId: true, createdAt: true }
  });
  console.log('\n=== SON WASTE REQUESTS ===');
  console.log('Toplam (son 5):', requests.length);
  requests.forEach(r => console.log(' -', r.id.substring(0,8), '| status:', r.status, '| userId:', r.userId.substring(0,8)));
  
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
