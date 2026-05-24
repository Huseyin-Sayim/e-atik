const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, 'data-backups/waste-requests-backup.json');

async function main() {
  const requests = await prisma.wasteRequest.findMany({
    include: {
      user: true
    },
    orderBy: { createdAt: 'desc' }
  });
  const backupDir = path.dirname(backupPath);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  fs.writeFileSync(backupPath, JSON.stringify(requests, null, 2), 'utf-8');
  console.log('✅ [SCRATCH] Evsel atık talepleri yedeklendi:', requests.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
