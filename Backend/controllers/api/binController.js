const { PrismaClient } = require('@prisma/client');
const { assertPointInParcel } = require('../../services/campusParcels');
const {
  calculatePredictedFullness,
  enrichBinWithFullness,
  getLastEmptiedAt,
  normalizeFullnessRatio,
} = require('../../services/binFullness');
const { findLatestEmptiedAtByBinIds } = require('../../services/binFullnessRepository');
const { emitBinFullnessUpdated } = require('../../services/binFullnessBroadcast');

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

const regionSelect = { select: { id: true, name: true, region_id: true } };

async function resolveRegionFromParcelKey(parcelKey) {
  if (!parcelKey) return null;
  return prisma.region.findFirst({
    where: { region_id: String(parcelKey) },
  });
}

async function attachFullnessAndSync(bins) {
  if (!bins.length) {
    return [];
  }

  const binIds = bins.map((b) => b.id);
  const latestMap = await findLatestEmptiedAtByBinIds(binIds);
  const now = new Date();

  const enriched = bins.map((bin) =>
    enrichBinWithFullness(bin, latestMap.get(bin.id), now)
  );

  await Promise.all(
    enriched.map((bin) =>
      prisma.bin.update({
        where: { id: bin.id },
        data: { predictedFullness: bin.predictedFullness },
      })
    )
  );

  return enriched;
}

const getBins = async (req, res) => {
  try {
    const { regionId } = req.query;
    const where = {};
    if (regionId && typeof regionId === 'string') {
      where.regionId = regionId;
    }
    let bins = await prisma.bin.findMany({
      where,
      include: { region: regionSelect },
      orderBy: { createdAt: 'desc' },
    });
    const enriched = await attachFullnessAndSync(bins);
    res.status(200).json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getBinById = async (req, res) => {
  try {
    const { id } = req.params;
    let bin = await prisma.bin.findUnique({
      where: { id },
      include: { region: regionSelect },
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
      include: { region: regionSelect },
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
    if (parcelKey !== undefined && parcelKey !== null && parcelKey !== '') {
      data.regionId = nextRegionId;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'Güncellenecek alan yok.' });
    }

    await prisma.bin.update({
      where: { id },
      data,
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

// Atık toplama rotası için eklenen fonksiyon
const collectBin = async (req, res) => {
  try {
    const { id } = req.params;
    const bin = await prisma.bin.update({
      where: { id },
      data: { predictedFullness: 0 },
      include: { region: true }
    });
    broadcastBinEvent('binUpdated', bin);
    res.status(200).json({ message: 'Atık başarıyla toplandı.', data: bin });
  } catch (err) {
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
            predictedFullness: normalizeFullnessRatio(bin.predictedFullness || 0),
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
          predictedFullness: normalizeFullnessRatio(bin.fillPercentage || 0),
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
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const collectBin = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user?.userId;

    if (!employeeId) {
      return res.status(401).json({ message: 'Giriş yapınız.' });
    }

    const bin = await prisma.bin.findUnique({
      where: { id },
      include: { region: regionSelect },
    });

    if (!bin) {
      return res.status(404).json({ message: 'Çöp kutusu bulunamadı.' });
    }

    const latestMap = await findLatestEmptiedAtByBinIds([id]);
    const lastEmptiedAt = getLastEmptiedAt(bin, latestMap.get(id));
    const actualFullness = calculatePredictedFullness(bin, lastEmptiedAt);

    const [log, updatedBin] = await prisma.$transaction([
      prisma.collectionLog.create({
        data: {
          binId: id,
          employeeId,
          actualFullness,
        },
      }),
      prisma.bin.update({
        where: { id },
        data: { predictedFullness: 0 },
        include: { region: regionSelect },
      }),
    ]);

    const enriched = enrichBinWithFullness(updatedBin, log.emptiedAt);

    emitBinFullnessUpdated(id).catch((err) => {
      console.error('[collectBin] fullness broadcast', err);
    });

    res.status(201).json({
      message: 'Kova boşaltma kaydı oluşturuldu.',
      data: {
        collectionLog: log,
        bin: enriched,
      },
    });
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
  seedDefaultBins,
  collectBin,
};
