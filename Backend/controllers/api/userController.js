const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const userListSelect = {
  id: true,
  name: true,
  surname: true,
  email: true,
  phoneNumber: true,
  role: true,
  employeeType: true,
  city: true,
  district: true,
  regionId: true,
  isVerified: true,
  createdAt: true,
};

const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: userListSelect,
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({
      message: 'success',
      data: users,
    });
  } catch (err) {
    res.status(500).json({
      message: 'Kullanıcılar getirilemedi.',
      error: err.message,
    });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, employeeType } = req.body;
    const actorId = req.user.userId;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!target) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }

    const supervisorRoles = ['ADMIN', 'BOSS'];
    const demotedRoles = ['USER', 'EMPLOYEE'];

    if (
      id === actorId &&
      supervisorRoles.includes(target.role) &&
      demotedRoles.includes(role)
    ) {
      return res.status(400).json({
        message: 'Kendi yönetici yetkinizi kaldıramazsınız.',
      });
    }

    const data = {
      role,
      employeeType: role === 'EMPLOYEE' ? employeeType : null,
    };

    const user = await prisma.user.update({
      where: { id },
      data,
      select: userListSelect,
    });

    return res.status(200).json({
      message: 'Kullanıcı yetkileri güncellendi.',
      data: user,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Kullanıcı güncellenemedi.',
      error: err.message,
    });
  }
};

const updateWorkRegion = async (req, res) => {
  try {
    const { regionId } = req.body;
    const userId = req.user.userId;

    const region = await prisma.region.findUnique({
      where: { id: regionId },
    });

    if (!region) {
      return res.status(404).json({ message: 'Bölge bulunamadı.' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { regionId },
      select: {
        id: true,
        regionId: true,
        region: {
          select: {
            id: true,
            name: true,
            region_id: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: 'Çalışma bölgeniz kaydedildi.',
      data: user,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Çalışma bölgesi kaydedilemedi.',
      error: err.message,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.delete({
      where: {
        id: userId
      }
    })
    res.status(200).json({
      message: "success",
      data: user,
      id: userId
    })
  } catch (err) {
    return res.status(500).json({message: 'Bir hata oluştu'})
  }
}

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { profileImage, profileType, name, surname, city, district, regionId, phoneNumber, theme } = req.body;
    
    // Prepare update data
    const updateData = {
      ...(profileImage !== undefined && { profileImage }),
      ...(profileType && { profileType }),
      ...(theme && { theme }), // Tema desteği eklendi
      ...(name && { name }),
      ...(phoneNumber && { phoneNumber }),
      ...(surname && { surname }),
      ...(city && { city }),
      ...(district && { district }),
    };

    if (regionId !== undefined && regionId !== null && regionId !== '') {
      // regionId hem UUID hem de 'akademik' gibi bir string olabilir
      const region = await prisma.region.findFirst({
        where: {
          OR: [
            // regionId geçerli bir UUID formatındaysa kontrol et
            ...(regionId.length > 20 ? [{ id: regionId }] : []),
            { region_id: String(regionId) } // 'akademik', 'hastane' gibi string ise
          ]
        }
      });

      if (region) {
        updateData.regionId = region.id;
      } else {
        console.warn(`⚠️ Bölge eşleşmedi: ${regionId}`);
      }
    } else if (regionId === null || regionId === '') {
      updateData.regionId = null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        region: true
      }
    });
    res.status(200).json({
      message: "Profil başarıyla güncellendi.",
      data: updatedUser
    });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ message: "Profil güncellenirken bir hata oluştu.", error: err.message });
  }
}

const getUserProfile = async (req, res) => {
  try {
    const {userId} = req.user; // isAuth middleware'inden geliyor
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallet: true,
        region: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    }

    res.status(200).json({
      message: "Profil bilgileri başarıyla getirildi.",
      data: user
    });
  } catch (err) {
    res.status(500).json({ message: "Kullanıcı bilgileri getirilirken bir sunucu hatası oluştu.", error: err.message });
  }
}

const normalizeCode = (code) => {
  if (!code) return "";
  let normalized = code.toString().trim();
  // Barkodlar için sayısal normalizasyon (Örn: 12 haneli UPC-A ise başına 0 koyarak EAN-13'e eşitleriz)
  if (/^\d+$/.test(normalized)) {
    if (normalized.length === 12) {
      normalized = "0" + normalized;
    }
  }
  return normalized;
};

const scanQrCode = async (req, res) => {
  try {
    const { userId } = req.user;
    const { code, coins, description, scanType } = req.body;

    if (!code || !coins) {
      return res.status(400).json({ message: "QR Kodu ve coin değeri gereklidir." });
    }

    const normalizedCode = normalizeCode(code);

    // Check if the QR/Barcode code was already scanned (using findFirst for extra safety)
    const existingScan = await prisma.scannedQRCode.findFirst({
      where: { code: normalizedCode }
    });

    if (existingScan) {
      return res.status(400).json({ message: "Bu kod daha önce kullanılmış." });
    }

    // Run transaction: create scan record, update wallet, and record transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the scanned record
      const newScan = await tx.scannedQRCode.create({
        data: {
          code: normalizedCode,
          userId,
          coinsEarned: coins
        }
      });

      // 2. Update user's wallet
      const wallet = await tx.wallet.upsert({
        where: { userId },
        update: {
          balance: { increment: coins }
        },
        create: {
          userId,
          balance: coins
        }
      });

      // 3. Create a transaction log
      const displayCode = scanType === 'barcode' 
        ? normalizedCode 
        : (normalizedCode.length > 8 ? normalizedCode.substring(0, 8) + '...' : normalizedCode);
      
      let formattedDesc = description || "Geri Dönüşüm Ödülü";
      const suffix = `(${scanType === 'barcode' ? 'barkod' : 'qr'} | ${displayCode})`;
      
      if (!formattedDesc.includes('(qr |') && !formattedDesc.includes('(barkod |')) {
        formattedDesc = `${formattedDesc} ${suffix}`;
      }

      await tx.transaction.create({
        data: {
          amount: coins,
          type: "EARNED",
          description: formattedDesc,
          userId
        }
      });

      return wallet;
    });

    res.status(200).json({
      message: `${scanType === 'barcode' ? 'Barkod' : 'QR Kod'} başarıyla okundu ve coinler hesabınıza eklendi.`,
      balance: result.balance
    });
  } catch (err) {
    console.error("Tarama kodu okuma hatası:", err);
    res.status(500).json({ message: "Tarama kodu işlenirken bir hata oluştu.", error: err.message });
  }
}

const getUserTransactions = async (req, res) => {
  try {
    const { userId } = req.user;
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({
      message: "İşlem geçmişi başarıyla getirildi.",
      data: transactions
    });
  } catch (err) {
    res.status(500).json({
      message: "İşlem geçmişi getirilirken bir hata oluştu.",
      error: err.message
    });
  }
}

module.exports = {
  getUsers,
  updateUserRole,
  updateWorkRegion,
  deleteUser,
  updateProfile,
  getUserProfile,
  scanQrCode,
  getUserTransactions,
};
