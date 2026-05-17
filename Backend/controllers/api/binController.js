const { PrismaClient } = require('@prisma/client');
const { assertPointInParcel } = require('../../services/campusParcels');
const {
  calculatePredictedFullness,
  enrichBinWithFullness,
  getLastEmptiedAt,
} = require('../../services/binFullness');
const { findLatestEmptiedAtByBinIds } = require('../../services/binFullnessRepository');

const prisma = new PrismaClient();

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
    const bins = await prisma.bin.findMany({
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
    const bin = await prisma.bin.findUnique({
      where: { id },
      include: { region: regionSelect },
    });
    if (!bin) {
      return res.status(404).json({ message: 'Çöp kutusu bulunamadı.' });
    }

    const [enriched] = await attachFullnessAndSync([bin]);
    res.status(200).json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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
        predictedFullness: 0,
      },
      include: { region: regionSelect },
    });

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

    const bin = await prisma.bin.findUnique({
      where: { id },
      include: { region: regionSelect },
    });
    const [enriched] = await attachFullnessAndSync([bin]);

    res.status(200).json({ message: 'Çöp kutusu güncellendi.', data: enriched });
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
    res.status(200).json({ message: 'Çöp kutusu silindi.' });
  } catch (err) {
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
  getBinById,
  createBin,
  updateBin,
  deleteBin,
  collectBin,
};
