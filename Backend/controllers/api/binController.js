const { PrismaClient } = require('@prisma/client');
const { assertPointInParcel } = require('../../services/campusParcels');

const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// ============================================================
// YARDIMCI: Benzersiz QR Kod ve EAN-13 tarzı Barkod üreteci
// ============================================================
function generateUniqueQR() {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `QR-BIN-${rand}-${ts}`;
}

function generateUniqueBarcode() {
  // EAN-13 formatı: 978 + 10 rastgele rakam (Toplam 13 hane)
  // digits değişkeninin mükerrer tanımlanması düzeltildi.
  const randomDigits = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
  return `978${randomDigits}`;
}

// ============================================================
// YARDIMCI: WebSocket broadcast – tüm açık bağlantılara gönder
// ============================================================
function broadcastBinEvent(type, data) {
  try {
    const wss = global.wss;
    if (!wss) return;
    const msg = JSON.stringify({ type, data });
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(msg);
      }
    });
    console.log(`📡 [WS BROADCAST] ${type} → ${wss.clients.size} istemci`);
  } catch (err) {
    console.error('broadcastBinEvent hatası:', err);
  }
}

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
  try {
    const { regionId } = req.query;

    // Her zaman güncel DB'den çek (proaktif QR/Barkod doldurma için)
    console.log('📖 [OKUMA] Çöp kutuları veritabanından okunuyor...');
    const where = {};
    if (regionId && typeof regionId === 'string') {
      where.regionId = regionId;
    }
    let bins = await prisma.bin.findMany({
      where,
      include: { region: { select: { id: true, name: true, region_id: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Proaktif QR/Barkod doldurma: null kalmış eski kayıtları güncelle
    const nullBins = bins.filter(b => !b.qrCode || !b.barCode);
    if (nullBins.length > 0) {
      console.log(`⚙️ [QR/BARKOD] ${nullBins.length} kutuda QR/Barkod eksik, otomatik dolduruluyor...`);
      for (const b of nullBins) {
        const updateData = {};
        if (!b.qrCode) updateData.qrCode = generateUniqueQR();
        if (!b.barCode) updateData.barCode = generateUniqueBarcode();
        await prisma.bin.update({ where: { id: b.id }, data: updateData });
        Object.assign(b, updateData);
      }
      console.log('✅ [QR/BARKOD] Eksik kodlar başarıyla tamamlandı.');
    }

    // Yedek dosyasını güncelle
    const backupPath = path.join(__dirname, '../../data-backups/bins-backup.json');
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(backupPath, JSON.stringify(bins, null, 2), 'utf-8');

    res.status(200).json(bins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getBinById = async (req, res) => {
  try {
    const { id } = req.params;
    let bin = await prisma.bin.findUnique({
      where: { id },
      include: { region: { select: { id: true, name: true, region_id: true } } },
    });
    if (!bin) {
      return res.status(404).json({ message: 'Çöp kutusu bulunamadı.' });
    }

    // Proaktif QR/Barkod doldurma
    if (!bin.qrCode || !bin.barCode) {
      const updateData = {};
      if (!bin.qrCode) updateData.qrCode = generateUniqueQR();
      if (!bin.barCode) updateData.barCode = generateUniqueBarcode();
      bin = await prisma.bin.update({
        where: { id },
        data: updateData,
        include: { region: { select: { id: true, name: true, region_id: true } } },
      });
      console.log(`✅ [QR/BARKOD] ID=${id} kutusu için eksik kodlar üretildi.`);
      await backupBins();
    }

    res.status(200).json(bin);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Yeni kutu oluştur
const createBin = async (req, res) => {
  try {
    const { name, latitude, longitude, wasteCategory, type, capacityVolume, predictedFullness, regionId: parcelKey } = req.body;

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

    // Benzersiz QR Kod ve Barkod üret
    const qrCode = generateUniqueQR();
    const barCode = generateUniqueBarcode();

    // Senkronizasyon için QR ve Barkod'un anında eklendiğinden emin oluyoruz
    // Bu sayede mobil uygulama 'binCreated' event'ini aldığında kodlar hazır olur.
    const bin = await prisma.bin.create({
      data: {
        name: name || null,
        latitude,
        longitude,
        wasteCategory,
        type,
        capacityVolume,
        predictedFullness: predictedFullness !== undefined ? parseFloat(predictedFullness) : 0.0,
        regionId: region.id,
        qrCode,
        barCode,
      },
      include: { region: { select: { id: true, name: true, region_id: true } } },
    });

    await backupBins();

    // WebSocket: tüm bağlı istemcilere bildir
    broadcastBinEvent('binCreated', bin);

    console.log(`✅ [CREATE] Kutu oluşturuldu: ${bin.id} | QR: ${qrCode} | Barkod: ${barCode}`);
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
      name,
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
    if (name !== undefined) data.name = name;
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

    // Güncelleme sonrası tüm cihazlara anlık bildirim gönder
    broadcastBinEvent('binUpdated', bin);

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

    // WebSocket: silme olayını tüm istemcilere yayınla
    broadcastBinEvent('binDeleted', { id });

    res.status(200).json({ message: 'Çöp kutusu silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// YARDIMCI: Anlaşmalı Mağazalar (Partner Stores) Handlers
// ============================================================
const getPartnerStores = async (req, res) => {
  try {
    // Prisma modelinizde PartnerStore varsa oradan çekiyoruz
    const stores = await prisma.partnerStore?.findMany() || [];
    res.status(200).json(stores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addPartnerStore = async (req, res) => {
  try {
    const { name, latitude, longitude, address, category } = req.body;
    const store = await prisma.partnerStore.create({
      data: { name, latitude: parseFloat(latitude), longitude: parseFloat(longitude), address, category }
    });
    res.status(201).json(store);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deletePartnerStore = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.partnerStore.delete({ where: { id } });
    res.status(200).json({ message: 'Mağaza silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Kutu Boşaltma (Fullness sıfırlama)
const emptyBin = async (req, res) => {
  try {
    const { id } = req.params;
    const bin = await prisma.bin.update({
      where: { id },
      data: { predictedFullness: 0 },
      include: { region: true }
    });
    broadcastBinEvent('binUpdated', bin);
    res.status(200).json({ message: 'Kutu boşaltıldı.', data: bin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Kutu doluluk oranını güncelleme (Sadece isAuth kontrolü ile çalışır)
const updateBinFullness = async (req, res) => {
  try {
    const { id } = req.params;
    const { predictedFullness } = req.body;

    if (predictedFullness === undefined) {
      return res.status(400).json({ message: 'Doluluk oranı belirtilmelidir.' });
    }

    const existing = await prisma.bin.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Çöp kutusu bulunamadı.' });
    }

    const bin = await prisma.bin.update({
      where: { id },
      data: { predictedFullness: Number(predictedFullness) },
      include: { region: { select: { id: true, name: true, region_id: true } } },
    });

    broadcastBinEvent('binUpdated', bin);
    await backupBins();

    res.status(200).json({ message: 'Doluluk oranı güncellendi.', data: bin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getBins,
  getAllBins: getBins,    // binRoutes.js bu ismi bekliyor olabilir
  getBinById,
  getBin: getBinById,     // Olası isim uyuşmazlığı için
  createBin,
  addBin: createBin,      // DatabaseService.ts bunu bekliyor
  updateBin,
  updateBinItem: updateBin, // DatabaseService.ts bunu bekliyor
  deleteBin,
  deleteBinItem: deleteBin, // DatabaseService.ts bunu bekliyor
  // Partner Store Handlers
  getPartnerStores,
  addPartnerStore,
  createPartnerStore: addPartnerStore,
  deletePartnerStore,
  // Custom Actions
  emptyBin,
  updateBinFullness
};

// ZORLA 21