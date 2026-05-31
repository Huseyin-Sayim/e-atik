const { PrismaClient } = require('@prisma/client');
const { getWasteTypeTree, wasteTypeSelect } = require('../../services/wasteTypes');

const prisma = new PrismaClient();

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function uniqueSlug(base, excludeId = null) {
  let slug = base;
  let n = 0;
  while (true) {
    const existing = await prisma.wasteType.findFirst({
      where: {
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (!existing) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

const listWasteTypes = async (req, res) => {
  try {
    const tree = await getWasteTypeTree({ activeOnly: true });
    res.status(200).json({ message: 'success', data: tree });
  } catch (err) {
    res.status(500).json({ message: 'Atık türleri getirilemedi.', error: err.message });
  }
};

const listWasteTypesAdmin = async (req, res) => {
  try {
    const tree = await getWasteTypeTree({ activeOnly: false, includeInactive: true });
    res.status(200).json({ message: 'success', data: tree });
  } catch (err) {
    res.status(500).json({ message: 'Atık türleri getirilemedi.', error: err.message });
  }
};

const createWasteType = async (req, res) => {
  try {
    const { parentId, name, coinRewardMode, coinRewardValue, sortOrder } = req.body;

    const parent = await prisma.wasteType.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true, name: true },
    });

    if (!parent || parent.parentId != null) {
      return res.status(400).json({
        message: 'Yalnızca ana kategorilerin altına yeni atık türü eklenebilir.',
      });
    }

    const baseSlug = slugify(name);
    const slug = await uniqueSlug(`${parent.name}-${baseSlug}`.replace(/\s+/g, '-').toLowerCase());

    const created = await prisma.wasteType.create({
      data: {
        slug,
        name: name.trim(),
        parentId,
        coinRewardMode,
        coinRewardValue,
        sortOrder: sortOrder ?? 0,
        isActive: true,
      },
      select: wasteTypeSelect,
    });

    res.status(201).json({
      message: 'Atık türü eklendi.',
      data: created,
    });
  } catch (err) {
    res.status(500).json({ message: 'Atık türü eklenemedi.', error: err.message });
  }
};

const updateWasteType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, coinRewardMode, coinRewardValue, sortOrder, isActive } = req.body;

    const existing = await prisma.wasteType.findUnique({
      where: { id },
      select: { id: true, parentId: true, name: true },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Atık türü bulunamadı.' });
    }

    if (existing.parentId == null) {
      return res.status(400).json({
        message: 'Ana kategoriler bu ekrandan düzenlenemez.',
      });
    }

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (coinRewardMode !== undefined) data.coinRewardMode = coinRewardMode;
    if (coinRewardValue !== undefined) data.coinRewardValue = coinRewardValue;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.wasteType.update({
      where: { id },
      data,
      select: wasteTypeSelect,
    });

    res.status(200).json({
      message: 'Atık türü güncellendi.',
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ message: 'Atık türü güncellenemedi.', error: err.message });
  }
};

module.exports = {
  listWasteTypes,
  listWasteTypesAdmin,
  createWasteType,
  updateWasteType,
};
