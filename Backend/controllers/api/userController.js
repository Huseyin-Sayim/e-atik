const {PrismaClient} = require("@prisma/client");

const prisma = new PrismaClient();

const getUsers =  async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.status(200).json({
      message: "Kullanıcılar başarıyla getirildi.",
      data: users
    })
  } catch (err) {
    res.status(500).json({
      message: "Kullanıcı listesi getirilemedi.",
      error: err.message
    })
  }
}

const deleteUser = async (req, res) => {
  try {
    const {id} = req.user;
    const user = await prisma.user.delete({
      where: {
        id
      }
    })
    res.status(200).json({
      message: "success",
      data: user
    })
  } catch (err) {
    return res.status(500).json({message: 'Bir hata oluştu'})
  }
}

const updateProfile = async (req, res) => {
  try {
    const { email, profileImage, profileType, name, surname, city, district, regionId } = req.body;
    
    // Prepare update data
    const updateData = {
      ...(profileImage !== undefined && { profileImage }),
      ...(profileType && { profileType }),
      ...(name && { name }),
      ...(surname && { surname }),
      ...(city && { city }),
      ...(district && { district }),
    };

    if (regionId !== undefined) {
      if (regionId === null || regionId === '') {
        updateData.region = { disconnect: true };
      } else {
        updateData.region = {
          connectOrCreate: {
            where: { name: regionId },
            create: { name: regionId, region_id: regionId }
          }
        };
      }
    }

    const updatedUser = await prisma.user.update({
      where: { email: email.toLowerCase() },
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
  deleteUser,
  updateProfile,
  getUserProfile,
  scanQrCode,
  getUserTransactions
}