const { PrismaClient } = require('@prisma/client');
const { assertPointInParcel } = require('../../services/campusParcels');

const prisma = new PrismaClient();

async function resolveRegionFromParcelKey(parcelKey) {
  if (!parcelKey) return null;
  return prisma.region.findFirst({
    where: { region_id: String(parcelKey) },
  });
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
      include: { region: { select: { id: true, name: true, region_id: true } } },
      orderBy: { createdAt: 'desc' },
    });
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
    res.status(200).json({ message: 'Çöp kutusu silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getBins,
  getBinById,
  createBin,
  updateBin,
  deleteBin,
};
