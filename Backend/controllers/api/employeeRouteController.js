const { PrismaClient } = require('@prisma/client');
const { planEmployeeRoute, planRouteLeg } = require('../../services/routePlanner');
const { enrichBinsReadOnly, getRegionFullnessAlerts } = require('../../services/employeeRegionAlerts');
const { toFullnessPercent } = require('../../services/binFullness');
const {
  setEmployeeRouteProgress,
  getEmployeeRouteProgress,
} = require('../../services/employeeRouteProgressStore');

const prisma = new PrismaClient();

async function getRoutePlan(req, res) {
  try {
    const startLat = req.query.startLat != null ? parseFloat(req.query.startLat) : undefined;
    const startLng = req.query.startLng != null ? parseFloat(req.query.startLng) : undefined;

    if (
      (startLat != null && Number.isNaN(startLat)) ||
      (startLng != null && Number.isNaN(startLng))
    ) {
      return res.status(400).json({ message: 'Geçersiz başlangıç koordinatları.' });
    }

    const plan = await planEmployeeRoute(req.user.userId, { startLat, startLng });
    res.status(200).json(plan);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Rota hesaplanamadı.' });
  }
}

async function getRouteLeg(req, res) {
  try {
    const fromLat = parseFloat(req.query.fromLat);
    const fromLng = parseFloat(req.query.fromLng);
    const toLat = parseFloat(req.query.toLat);
    const toLng = parseFloat(req.query.toLng);

    if ([fromLat, fromLng, toLat, toLng].some((n) => Number.isNaN(n))) {
      return res.status(400).json({ message: 'Geçersiz koordinatlar.' });
    }

    const leg = await planRouteLeg(fromLat, fromLng, toLat, toLng);
    res.status(200).json(leg);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Yol tarifi alınamadı.' });
  }
}

async function getRegionBins(req, res) {
  try {
    const employee = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { regionId: true, region: { select: { id: true, name: true, region_id: true } } },
    });

    if (!employee?.regionId) {
      return res.status(200).json({
        needsRegionSelection: true,
        regionId: null,
        regionName: null,
        bins: [],
      });
    }

    const bins = await prisma.bin.findMany({
      where: { regionId: employee.regionId },
      select: {
        id: true,
        type: true,
        wasteCategory: true,
        latitude: true,
        longitude: true,
        capacityVolume: true,
        createdAt: true,
        predictedFullness: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = await enrichBinsReadOnly(bins);
    const payload = enriched.map((bin) => ({
      id: bin.id,
      type: bin.type,
      wasteCategory: bin.wasteCategory,
      latitude: bin.latitude,
      longitude: bin.longitude,
      predictedFullness: bin.predictedFullness,
      fullnessPercent: toFullnessPercent(bin.predictedFullness),
      lastEmptiedAt: bin.lastEmptiedAt,
      hoursToFull: bin.hoursToFull,
    }));

    res.status(200).json({
      needsRegionSelection: false,
      regionId: employee.regionId,
      regionName: employee.region?.name ?? null,
      regionParcelId: employee.region?.region_id ?? null,
      bins: payload,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Kova listesi alınamadı.' });
  }
}

async function getRegionAlerts(req, res) {
  try {
    const data = await getRegionFullnessAlerts(req.user.userId);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Uyarılar alınamadı.' });
  }
}

async function getRouteProgress(req, res) {
  try {
    const progress = getEmployeeRouteProgress(req.user.userId);
    res.status(200).json({
      progress: progress || { currentStep: 0, completedCount: 0, regionParcelId: null },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'İlerleme alınamadı.' });
  }
}

async function putRouteProgress(req, res) {
  try {
    const result = setEmployeeRouteProgress(req.user.userId, req.body);
    if (!result.ok) {
      return res.status(400).json({ message: 'Geçersiz ilerleme verisi.' });
    }
    res.status(200).json({ message: 'OK', progress: result.entry });
  } catch (err) {
    res.status(500).json({ message: err.message || 'İlerleme kaydedilemedi.' });
  }
}

module.exports = {
  getRoutePlan,
  getRouteLeg,
  getRegionBins,
  getRegionAlerts,
  getRouteProgress,
  putRouteProgress,
};
