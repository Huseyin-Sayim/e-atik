const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Veritabanı güncelleniyor...");
  const result = await prisma.wasteRequest.updateMany({
    where: {
      wasteTypeId: null
    },
    data: {
      wasteTypeId: 'wt-gen-mixed' // Varsayılan genel karışık atık türü ID'si
    }
  });
  console.log(`Tamamlandı! ${result.count} adet eski talep varsayılan atık türü (wt-gen-mixed) ile güncellendi.`);
}

main()
  .catch(e => {
    console.error("Hata oluştu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
