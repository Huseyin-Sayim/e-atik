const { PrismaClient } = require('@prisma/client');
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

// Varsayılan Kampüs Noktaları (Ege Üniversitesi)
const DEFAULT_BINS = [
  { latitude: 38.455490, longitude: 27.214470, fillPercentage: 10, type: 'kagit', name: 'Ziraat Fakültesi' },
  { latitude: 38.452668, longitude: 27.210986, fillPercentage: 35, type: 'cam', name: 'Su Ürünleri Fakültesi' },
  { latitude: 38.452331, longitude: 27.212005, fillPercentage: 70, type: 'plastik', name: 'Spor Bilimleri Fakültesi' },
  { latitude: 38.453303, longitude: 27.213233, fillPercentage: 5, type: 'genel', name: 'Ziraat Fakültesi Dekanlık' },
  { latitude: 38.454228, longitude: 27.214150, fillPercentage: 45, type: 'kagit', name: 'Ziraat Kampüs İçi' },
  { latitude: 38.456671, longitude: 27.214275, fillPercentage: 80, type: 'plastik', name: 'Fen Fakültesi Otopark' },
  { latitude: 38.456314, longitude: 27.212711, fillPercentage: 20, type: 'cam', name: 'Ege MYO' },
  { latitude: 38.455823, longitude: 27.210996, fillPercentage: 90, type: 'genel', name: 'Diş Hekimliği Fakültesi' },
  { latitude: 38.454707, longitude: 27.209355, fillPercentage: 15, type: 'kagit', name: 'Tıp Fakültesi Hastanesi' },
  { latitude: 38.453396, longitude: 27.209230, fillPercentage: 60, type: 'plastik', name: 'Hemşirelik Fakültesi' },
  { latitude: 38.455896, longitude: 27.218559, fillPercentage: 30, type: 'cam', name: 'İletişim Fakültesi' },
  { latitude: 38.457850, longitude: 27.220138, fillPercentage: 50, type: 'genel', name: 'Merkezi Kütüphane' },
  { latitude: 38.459385, longitude: 27.218320, fillPercentage: 75, type: 'kagit', name: 'Edebiyat Fakültesi' },
  { latitude: 38.460113, longitude: 27.216345, fillPercentage: 40, type: 'plastik', name: 'Eğitim Fakültesi' },
  { latitude: 38.461019, longitude: 27.215560, fillPercentage: 85, type: 'cam', name: 'İktisadi ve İdari Bilimler Fakültesi' },
  { latitude: 38.463378, longitude: 27.213960, fillPercentage: 10, type: 'genel', name: 'Mühendislik Fakültesi' },
  { latitude: 38.465110, longitude: 27.215855, fillPercentage: 95, type: 'kagit', name: 'Yabancı Diller Yüksekokulu' },
  { latitude: 38.461972, longitude: 27.221503, fillPercentage: 25, type: 'plastik', name: 'Öğrenci Köyü' },
  { latitude: 38.459972, longitude: 27.223847, fillPercentage: 65, type: 'cam', name: 'KYK Kız Yurdu' },
  { latitude: 38.456389, longitude: 27.225501, fillPercentage: 55, type: 'genel', name: 'Ege Üniversitesi Hastanesi' },
  { latitude: 38.453531, longitude: 27.221376, fillPercentage: 15, type: 'kagit', name: 'Tıp Fakültesi Dekanlık' }
];

// Tüm kutuları getir
const getBins = async (req, res) => {
  try {
    const backupPath = path.join(__dirname, '../../data-backups/bins-backup.json');
    if (fs.existsSync(backupPath)) {
      const raw = fs.readFileSync(backupPath, 'utf-8');
      const bins = JSON.parse(raw);
      console.log('📖 [OKUMA] Çöp kutuları doğrudan bins-backup.json dosyasından okundu.');
      return res.status(200).json(bins);
    }

    // Eğer yedek dosyası yoksa veritabanından çek ve yedek dosyasını sıfırdan oluştur
    console.log('⚠️ [OKUMA] bins-backup.json bulunamadı. Veritabanından okunuyor...');
    const bins = await prisma.bin.findMany({
      orderBy: { createdAt: 'desc' }
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
}

// Yeni kutu oluştur
const createBin = async (req, res) => {
  try {
    const { name, latitude, longitude, wasteCategory, type, capacityVolume, regionId, predictedFullness } = req.body;
    
    const dataPayload = {
      name: name || 'Adsız Kutu',
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      wasteCategory: wasteCategory || 'GENERAL',
      type: type || 'WASTE_POINT',
      capacityVolume: parseFloat(capacityVolume || 100),
      predictedFullness: parseFloat(predictedFullness || 0),
    };

    if (regionId) {
      dataPayload.regionId = regionId;
    }

    const newBin = await prisma.bin.create({
      data: dataPayload
    });

    await backupBins();

    res.status(201).json({ message: 'Çöp Kutusu başarıyla oluşturuldu.', bin: newBin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Kutuyu güncelle
const updateBin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, latitude, longitude, predictedFullness, wasteCategory } = req.body;

    const updatedBin = await prisma.bin.update({
      where: { id },
      data: {
        name,
        latitude: latitude !== undefined ? parseFloat(latitude) : undefined,
        longitude: longitude !== undefined ? parseFloat(longitude) : undefined,
        predictedFullness: predictedFullness !== undefined ? parseFloat(predictedFullness) : undefined,
        wasteCategory
      }
    });

    await backupBins();

    res.status(200).json({ message: 'Kutu başarıyla güncellendi.', bin: updatedBin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Kutuyu sil
const deleteBin = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.bin.delete({
      where: { id }
    });

    await backupBins();

    res.status(200).json({ message: 'Kutu başarıyla silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

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
}

module.exports = {
  getBins,
  createBin,
  updateBin,
  deleteBin,
  seedDefaultBins
}