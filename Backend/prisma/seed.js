const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'password';

/** GeoJSON feature id ile Region.region_id birebir eşleşmeli (kampusParsel.geojson). */
const campusRegions = [
  {
    name: 'Ege Üniversitesi Akademik ve Sosyal Yerleşke',
    region_id: 'akademik',
  },
  {
    name: 'Ege Üniversitesi Hastane Kompleksi',
    region_id: 'hastane',
  },
  {
    name: 'Ege Üniversitesi Spor ve Giriş Hattı',
    region_id: 'kyk',
  },
];

const demoUsers = [
  {
    name: 'Boss Admin',
    email: 'huseyinn.sayim@gmail.com',
    phoneNumber: '5551000001',
    role: 'BOSS',
    employeeType: null,
  },
  {
    name: 'Demo User',
    email: 'user@info.com',
    phoneNumber: '5551000002',
    role: 'USER',
    employeeType: null,
  },
  {
    name: 'Demo Collector',
    email: 'employee@info.com',
    phoneNumber: '5551000003',
    role: 'EMPLOYEE',
    employeeType: 'TRASH_COLLECTOR',
  },
];

function shouldSeedDemoUsers() {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.SEED_DEMO_USERS === 'true';
}

async function seedRegions() {
  for (const r of campusRegions) {
    await prisma.region.upsert({
      where: { name: r.name },
      update: { region_id: r.region_id },
      create: { name: r.name, region_id: r.region_id },
    });
  }
}

async function seedUsers() {
  if (!shouldSeedDemoUsers()) {
    console.log('Seed: demo kullanıcılar atlandı (production, SEED_DEMO_USERS!=true).');
    return;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        password: passwordHash,
        phoneNumber: u.phoneNumber,
        role: u.role,
        employeeType: u.employeeType,
        isVerified: true,
      },
      create: {
        name: u.name,
        email: u.email,
        password: passwordHash,
        phoneNumber: u.phoneNumber,
        role: u.role,
        employeeType: u.employeeType,
        isVerified: true,
      },
    });
  }
}

async function main() {
  await seedRegions();
  console.log('Seed: kampüs bölgeleri upsert edildi.');

  await seedUsers();
  if (shouldSeedDemoUsers()) {
    console.log('Seed: demo kullanıcılar upsert edildi.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
