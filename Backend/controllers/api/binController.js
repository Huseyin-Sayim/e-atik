const { PrismaClient } = require('@prisma/client');
const { assertPointInParcel } = require('../../services/campusParcels');

const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// Tüm aktif kutuları yerel diskte bins-backup.json dosyasına yedekleme fonksiyonu
const backupBins = async () => {
  try {
    const bins = await prisma.bin.findMany({
      orderBy: { createdAt: 'desc' }
    });
    const backupDir = path.join(__dirname, '../../data-backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupPath = path.join(backupDir, 'bins-backup.json');
    fs.writeFileSync(backupPath, JSON.stringify(bins, null, 2), 'utf-8');
    console.log('✅ [YEDEKLEME] Çöp kutuları başarıyla yerel diske yedeklendi:', backupPath);
  } catch (err) {
    console.error('❌ [YEDEKLEME] Çöp kutuları yedeklenirken hata oluştu:', err);
  }
};

async function resolveRegionFromParcelKey(parcelKey) {
  if (!parcelKey) return null;
  return prisma.region.findFirst({
    where: { region_id: String(parcelKey) },
  });
}

const getBins = async (req, res) => {
    const { regionId } = req.query;
    const backupPath = path.join(__dirname, '../../data-backups/bins-backup.json');
    if (fs.existsSync(backupPath)) {
      const raw = fs.readFileSync(backupPath, 'utf-8');
      let bins = JSON.parse(raw);
      console.log('📖 [OKUMA] Çöp kutuları doğrudan bins-backup.json dosyasından okundu.');
      if (regionId && typeof regionId === 'string') {
        bins = bins.filter(b => b.regionId === regionId || (b.region && b.region.region_id === regionId));
      }
      return res.status(200).json(bins);
    }

    // Eğer yedek dosyası yoksa veritabanından çek ve yedek dosyasını sıfırdan oluştur
    console.log('⚠️ [OKUMA] bins-backup.json bulunamadı. Veritabanından okunuyor...');
    const where = {};
    if (regionId && typeof regionId === 'string') {
      where.regionId = regionId;
    }
    const bins = await prisma.bin.findMany({
      where,
      include: { region: { select: { id: true, name: true, region_id: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    fs.writeFileSync(backupPath, JSON.stringify(bins, null, 2), 'utf-8');

    res.status(200).json(bins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getBinById = async (req, res) => {
  try {
    const { id } = req.params;
    const bin = await prisma.bin.findUnique({
      where: { id },
      include: { region: { select: { id: true, name: true, region_id: true } } },
    });
    if (!bin) {
      return res.status(404).json({ message: 'Çöp kutusu bulunamadı.' });
    }
    res.status(200).json(bin);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Yeni kutu oluştur
const createBin = async (req, res) => {
  try {
    const { latitude, longitude, wasteCategory, type, capacityVolume, regionId: parcelKey } = req.body;

    const inside = assertPointInParcel(latitude, longitude, parcelKey);
    if (!inside.ok) {
      return res.status(400).json({ message: inside.message });
    }

    const region = await resolveRegionFromParcelKey(parcelKey);
    if (!region) {
      return res.status(400).json({
        message:
          'Bu parsel için veritabanında bölge kaydı yok. Önce bölge ekleyin (region_id = ' + parcelKey + ').',
      });
    }

    const bin = await prisma.bin.create({
      data: {
        latitude,
        longitude,
        wasteCategory,
        type,
        capacityVolume,
        regionId: region.id,
      },
      include: { region: { select: { id: true, name: true, region_id: true } } },
    });

    await backupBins();

    res.status(201).json({ message: 'Çöp kutusu başarıyla oluşturuldu.', data: bin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const updateBin = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.bin.findUnique({
      where: { id },
      include: { region: true },
    });
    if (!existing) {
      return res.status(404).json({ message: 'Çöp kutusu bulunamadı.' });
    }

    const {
      latitude,
      longitude,
      wasteCategory,
      type,
      capacityVolume,
      predictedFullness,
      regionId: parcelKey,
    } = req.body;

    const nextLat = latitude !== undefined ? latitude : existing.latitude;
    const nextLng = longitude !== undefined ? longitude : existing.longitude;

    let nextRegionId = existing.regionId;
    let parcelForCheck = existing.region?.region_id;

    if (parcelKey !== undefined && parcelKey !== null && parcelKey !== '') {
      const region = await resolveRegionFromParcelKey(parcelKey);
      if (!region) {
        return res.status(400).json({
          message:
            'Bu parsel için veritabanında bölge kaydı yok. region_id = ' + parcelKey,
        });
      }
      nextRegionId = region.id;
      parcelForCheck = region.region_id;
    }

    const inside = assertPointInParcel(nextLat, nextLng, parcelForCheck);
    if (!inside.ok) {
      return res.status(400).json({ message: inside.message });
    }

    const data = {};
    if (latitude !== undefined) data.latitude = latitude;
    if (longitude !== undefined) data.longitude = longitude;
    if (wasteCategory !== undefined) data.wasteCategory = wasteCategory;
    if (type !== undefined) data.type = type;
    if (capacityVolume !== undefined) data.capacityVolume = capacityVolume;
    if (predictedFullness !== undefined) data.predictedFullness = predictedFullness;
    if (parcelKey !== undefined && parcelKey !== null && parcelKey !== '') {
      data.regionId = nextRegionId;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'Güncellenecek alan yok.' });
    }

    const bin = await prisma.bin.update({
      where: { id },
      data,
      include: { region: { select: { id: true, name: true, region_id: true } } },
    });

    await backupBins();

    res.status(200).json({ message: 'Çöp kutusu güncellendi.', data: bin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const deleteBin = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.bin.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Çöp kutusu bulunamadı.' });
    }
    await prisma.bin.delete({ where: { id } });

    await backupBins();

    res.status(200).json({ message: 'Çöp kutusu silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ZORLA 21 NOKTAYI DB'YE EKLEME FONKSİYONU
const seedDefaultBins = async (req, res) => {
  try {
    // Önceki kutuları temizle
    await prisma.bin.deleteMany({});

    const backupPath = path.join(__dirname, '../../data-backups/bins-backup.json');
    let dataToInsert = null;
    let sourceMessage = 'varsayılan Ege Üniversitesi kampüs listesi';

    // Eğer yerel diskte bir yedekleme varsa, oradan yükle!
    if (fs.existsSync(backupPath)) {
      try {
        const raw = fs.readFileSync(backupPath, 'utf-8');
        const backedUpBins = JSON.parse(raw);
        if (backedUpBins && backedUpBins.length > 0) {
          dataToInsert = backedUpBins.map(bin => ({
            name: bin.name || 'Adsız Kutu',
            latitude: parseFloat(bin.latitude),
            longitude: parseFloat(bin.longitude),
            wasteCategory: bin.wasteCategory || 'GENERAL',
            type: bin.type || 'WASTE_POINT',
            capacityVolume: parseFloat(bin.capacityVolume || 100),
            predictedFullness: parseFloat(bin.predictedFullness || 0)
          }));
          sourceMessage = 'yerel JSON yedek dosyası (bins-backup.json)';
        }
      } catch (backupErr) {
        console.error('Yedek dosyası okunurken hata oluştu, varsayılanlara dönülüyor:', backupErr);
      }
    }

    // Yedek yoksa varsayılan listeyi kullan
    if (!dataToInsert) {
      const DEFAULT_BINS = [];
      dataToInsert = DEFAULT_BINS.map(bin => {
        let wasteCat = 'GENERAL';
        if (bin.type === 'plastik') wasteCat = 'PLASTIC';
        if (bin.type === 'cam') wasteCat = 'GLASS';
        if (bin.type === 'kagit') wasteCat = 'PAPER';

        return {
          name: bin.name,
          latitude: bin.latitude,
          longitude: bin.longitude,
          wasteCategory: wasteCat,
          type: 'WASTE_POINT',
          capacityVolume: 100,
          predictedFullness: bin.fillPercentage || 0,
        };
      });
    }

    await prisma.bin.createMany({
      data: dataToInsert
    });

    // Seedleme sonrası güncel durumu diskteki yedeğe yaz/eşitle
    await backupBins();

    const count = await prisma.bin.count();
    res.status(200).json({ 
      success: true, 
      message: `Harika! Veritabanına ${sourceMessage} üzerinden başarıyla ${count} kutu enjekte edildi.` 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
};

module.exports = {
  getBins,
  getBinById,
  createBin,
  updateBin,
  deleteBin,
};
