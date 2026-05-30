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
    name: 'Demo Admin',
    email: 'admin@info.com',
    phoneNumber: '5551000000',
    role: 'ADMIN',
    employeeType: null,
  },
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

/** Demo çalışan: Spor ve Giriş Hattı (kyk) — Benim Rotam önizlemesi için. */
async function assignDemoEmployeeWorkRegion() {
  if (!shouldSeedDemoUsers()) return;

  const kykRegion = await prisma.region.findFirst({
    where: { region_id: 'kyk' },
  });

  if (!kykRegion) return;

  await prisma.user.updateMany({
    where: { email: 'employee@info.com', role: 'EMPLOYEE' },
    data: { regionId: kykRegion.id },
  });
}

const wasteTypeSeed = [
  {
    id: 'wt-parent-domestic',
    slug: 'evsel-atik',
    name: 'Evsel atık',
    legacyEnum: 'DOMESTIC',
    sortOrder: 1,
    children: [
      { id: 'wt-dom-waste-oil', slug: 'evsel-atik-yag', name: 'Atık yağ', coinRewardMode: 'FLAT', coinRewardValue: 50, sortOrder: 1 },
      { id: 'wt-dom-food', slug: 'evsel-atik-gida', name: 'Gıda atığı', coinRewardMode: 'PER_KG', coinRewardValue: 8, sortOrder: 2 },
      { id: 'wt-dom-general', slug: 'evsel-atik-genel', name: 'Genel evsel', coinRewardMode: 'FLAT', coinRewardValue: 15, sortOrder: 3 },
    ],
  },
  {
    id: 'wt-parent-electronic',
    slug: 'elektronik',
    name: 'Elektronik',
    legacyEnum: 'ELECTRONIC',
    sortOrder: 2,
    children: [
      { id: 'wt-elec-device', slug: 'elektronik-cihaz', name: 'Elektronik cihaz', coinRewardMode: 'FLAT', coinRewardValue: 80, sortOrder: 1 },
      { id: 'wt-elec-battery', slug: 'elektronik-pil', name: 'Pil / akü', coinRewardMode: 'FLAT', coinRewardValue: 40, sortOrder: 2 },
    ],
  },
  {
    id: 'wt-parent-plastic',
    slug: 'plastik',
    name: 'Plastik',
    legacyEnum: 'PLASTIC',
    sortOrder: 3,
    children: [
      { id: 'wt-plas-pet', slug: 'plastik-pet', name: 'PET şişe', coinRewardMode: 'PER_KG', coinRewardValue: 12, sortOrder: 1 },
      { id: 'wt-plas-bag', slug: 'plastik-poset', name: 'Plastik poşet', coinRewardMode: 'FLAT', coinRewardValue: 5, sortOrder: 2 },
    ],
  },
  {
    id: 'wt-parent-glass',
    slug: 'cam',
    name: 'Cam',
    legacyEnum: 'GLASS',
    sortOrder: 4,
    children: [
      { id: 'wt-glass-bottle', slug: 'cam-sise', name: 'Cam şişe', coinRewardMode: 'PER_KG', coinRewardValue: 10, sortOrder: 1 },
    ],
  },
  {
    id: 'wt-parent-paper',
    slug: 'kagit',
    name: 'Kağıt',
    legacyEnum: 'PAPER',
    sortOrder: 5,
    children: [
      { id: 'wt-paper-cardboard', slug: 'kagit-karton', name: 'Karton', coinRewardMode: 'PER_KG', coinRewardValue: 6, sortOrder: 1 },
      { id: 'wt-paper-newspaper', slug: 'kagit-gazete', name: 'Gazete / kağıt', coinRewardMode: 'PER_KG', coinRewardValue: 5, sortOrder: 2 },
    ],
  },
  {
    id: 'wt-parent-general',
    slug: 'genel',
    name: 'Genel',
    legacyEnum: 'GENERAL',
    sortOrder: 6,
    children: [
      { id: 'wt-gen-mixed', slug: 'genel-karisik', name: 'Karışık atık', coinRewardMode: 'FLAT', coinRewardValue: 10, sortOrder: 1 },
    ],
  },
];

async function seedWasteTypes() {
  for (const parent of wasteTypeSeed) {
    const { children, ...parentData } = parent;
    await prisma.wasteType.upsert({
      where: { slug: parentData.slug },
      update: {
        name: parentData.name,
        sortOrder: parentData.sortOrder,
        legacyEnum: parentData.legacyEnum,
        isActive: true,
      },
      create: {
        id: parentData.id,
        slug: parentData.slug,
        name: parentData.name,
        legacyEnum: parentData.legacyEnum,
        sortOrder: parentData.sortOrder,
        coinRewardMode: 'FLAT',
        coinRewardValue: 0,
        isActive: true,
      },
    });

    const parentRow = await prisma.wasteType.findUnique({
      where: { slug: parentData.slug },
    });

    for (const child of children) {
      await prisma.wasteType.upsert({
        where: { slug: child.slug },
        update: {
          name: child.name,
          parentId: parentRow.id,
          coinRewardMode: child.coinRewardMode,
          coinRewardValue: child.coinRewardValue,
          sortOrder: child.sortOrder,
          isActive: true,
        },
        create: {
          id: child.id,
          slug: child.slug,
          name: child.name,
          parentId: parentRow.id,
          coinRewardMode: child.coinRewardMode,
          coinRewardValue: child.coinRewardValue,
          sortOrder: child.sortOrder,
          isActive: true,
        },
      });
    }
  }
}

async function main() {
  await seedRegions();
  console.log('Seed: kampüs bölgeleri upsert edildi.');

  await seedWasteTypes();
  console.log('Seed: atık türleri (ana + alt) upsert edildi.');

  await seedUsers();
  if (shouldSeedDemoUsers()) {
    console.log('Seed: demo kullanıcılar upsert edildi.');
    await assignDemoEmployeeWorkRegion();
    console.log('Seed: employee@info.com → Ege Üniversitesi Spor ve Giriş Hattı (kyk).');
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
