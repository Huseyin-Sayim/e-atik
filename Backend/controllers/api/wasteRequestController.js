const { PrismaClient } = require('@prisma/client');
const { assertPointInCampus, assertPointInParcel } = require('../../services/campusParcels');
const {
  validateLeafWasteTypeId,
  calculateEarnedCoins,
} = require('../../services/wasteTypes');
const { creditCoins } = require('../../services/coinLedger');

const prisma = new PrismaClient();

const wasteRequestInclude = {
  wasteType: {
    select: {
      id: true,
      name: true,
      slug: true,
      coinRewardMode: true,
      coinRewardValue: true,
      parent: { select: { id: true, name: true } },
    },
  },
  user: {
    select: { id: true, name: true, email: true, phoneNumber: true },
  },
};

const createWasteRequest = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Giriş yapınız.' });
    }

    const { wasteTypeId, latitude, longitude, addressLine, city, district, note } = req.body;
    const campus = assertPointInCampus(latitude, longitude);
    if (!campus.ok) {
      return res.status(400).json({ message: campus.message });
    }

    const typeCheck = await validateLeafWasteTypeId(wasteTypeId);
    if (!typeCheck.ok) {
      return res.status(400).json({ message: typeCheck.message });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { city: true, district: true },
    });

    const request = await prisma.wasteRequest.create({
      data: {
        userId,
        wasteTypeId,
        latitude,
        longitude,
        addressLine: addressLine.trim(),
        city: (city && String(city).trim()) || user?.city || null,
        district: (district && String(district).trim()) || user?.district || null,
        parcelKey: campus.parcelKey,
        note: note || null,
        status: 'PENDING',
      },
      include: wasteRequestInclude,
    });

    res.status(201).json({
      message: 'Atık talebi oluşturuldu.',
      data: request,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const getMyWasteRequests = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const requests = await prisma.wasteRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: wasteRequestInclude,
    });
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAllWasteRequests = async (req, res) => {
  try {
    const requests = await prisma.wasteRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: wasteRequestInclude,
    });
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateWasteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedEmployeeId } = req.body;

    const existing = await prisma.wasteRequest.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Talep bulunamadı.' });
    }

    const data = {};
    if (status !== undefined) data.status = status;
    if (assignedEmployeeId !== undefined) {
      data.assignedEmployeeId = assignedEmployeeId || null;
    }

    const updated = await prisma.wasteRequest.update({
      where: { id },
      data,
      include: wasteRequestInclude,
    });

    res.status(200).json({
      message: 'Talep güncellendi.',
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const collectWasteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user?.userId;
    const role = req.user?.role;
    const { weight } = req.body || {};

    if (!employeeId) {
      return res.status(401).json({ message: 'Giriş yapınız.' });
    }

    const existing = await prisma.wasteRequest.findUnique({
      where: { id },
      include: {
        wasteType: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Talep bulunamadı.' });
    }

    if (!['PENDING', 'ON_ROUTE'].includes(existing.status)) {
      return res.status(400).json({ message: 'Bu talep toplanamaz.' });
    }

    if (role === 'EMPLOYEE') {
      const employee = await prisma.user.findUnique({
        where: { id: employeeId },
        select: { employeeType: true },
      });
      if (employee?.employeeType !== 'WASTE_COLLECTOR') {
        return res.status(403).json({ message: 'Bu işlem yalnızca atık toplayıcılar içindir.' });
      }
      if (
        existing.assignedEmployeeId &&
        existing.assignedEmployeeId !== employeeId
      ) {
        return res.status(403).json({ message: 'Bu talep başka bir çalışana atanmış.' });
      }
    }

    const finalWeight = weight != null ? weight : existing.weight;
    const earnedCoins = calculateEarnedCoins(existing.wasteType, finalWeight);

    const updated = await prisma.$transaction(async (tx) => {
      const reqUpdated = await tx.wasteRequest.update({
        where: { id },
        data: {
          status: 'COLLECTED',
          assignedEmployeeId: existing.assignedEmployeeId || employeeId,
          weight: finalWeight,
          earnedCoins,
        },
        include: wasteRequestInclude,
      });

      if (earnedCoins > 0) {
        await creditCoins(existing.userId, earnedCoins, {
          description: `Atık talebi: ${existing.wasteType.name}`,
          tx,
        });
      }

      return reqUpdated;
    });

    res.status(200).json({
      message:
        earnedCoins > 0
          ? `Atık talebi toplandı. Kullanıcıya ${earnedCoins} coin aktarıldı.`
          : 'Atık talebi toplandı olarak işaretlendi.',
      data: updated,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createWasteRequest,
  getMyWasteRequests,
  getAllWasteRequests,
  updateWasteRequest,
  collectWasteRequest,
};
