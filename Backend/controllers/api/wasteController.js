const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '../../data-backups/waste-requests-backup.json');

// Tüm evsel atık taleplerini yerel diskte yedekleme fonksiyonu
const backupWasteRequests = async () => {
  try {
    const requests = await prisma.wasteRequest.findMany({
      include: {
        user: true
      },
      orderBy: { createdAt: 'desc' }
    });
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    fs.writeFileSync(backupPath, JSON.stringify(requests, null, 2), 'utf-8');
    console.log('✅ [YEDEKLEME] Evsel atık talepleri başarıyla yerel diske yedeklendi:', backupPath);
  } catch (err) {
    console.error('❌ [YEDEKLEME] Evsel atık talepleri yedeklenirken hata oluştu:', err);
  }
};

// Yeni Evsel Atık Talebi Oluştur
const createWasteRequest = async (req, res) => {
  try {
    const { userId } = req.user; // isAuth middleware'inden geliyor
    const { wasteType, note, latitude, longitude } = req.body;

    if (!wasteType || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Atık türü ve konum koordinatları gereklidir.' });
    }

    // WasteCategory enum kontrolü
    const validCategories = ['DOMESTIC', 'ELECTRONIC', 'PLASTIC', 'GLASS', 'PAPER', 'GENERAL'];
    if (!validCategories.includes(wasteType)) {
      return res.status(400).json({ message: 'Geçersiz atık kategorisi.' });
    }

    const newRequest = await prisma.wasteRequest.create({
      data: {
        userId,
        wasteType,
        note: note || '',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        status: 'PENDING'
      },
      include: {
        user: true
      }
    });

    // Dosya yedeklemesini güncelle
    await backupWasteRequests();

    // WebSocket üzerinden tüm bağlı istemcilere yeni talep oluşturulduğunu bildir
    if (global.wss) {
      global.wss.clients.forEach(client => {
        if (client.readyState === 1) { // 1 = OPEN
          client.send(JSON.stringify({ type: 'wasteRequestCreated', data: newRequest }));
        }
      });
    }

    res.status(201).json({
      message: 'Evsel atık talebiniz başarıyla kaydedilmiştir.',
      data: newRequest
    });
  } catch (err) {
    console.error('createWasteRequest hatası:', err);
    res.status(500).json({ message: 'Evsel atık talebi oluşturulurken bir sunucu hatası oluştu.', error: err.message });
  }
};

// Tüm Evsel Atık Taleplerini Getir (Öncelikli liste için)
const getWasteRequests = async (req, res) => {
  try {
    if (fs.existsSync(backupPath)) {
      const raw = fs.readFileSync(backupPath, 'utf-8');
      const requests = JSON.parse(raw);
      console.log('📖 [OKUMA] Evsel atık talepleri doğrudan waste-requests-backup.json dosyasından okundu.');
      return res.status(200).json(requests);
    }

    console.log('⚠️ [OKUMA] waste-requests-backup.json bulunamadı. Veritabanından okunuyor...');
    const requests = await prisma.wasteRequest.findMany({
      include: {
        user: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Yedek dosyasını sıfırdan oluştur
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    fs.writeFileSync(backupPath, JSON.stringify(requests, null, 2), 'utf-8');

    res.status(200).json(requests);
  } catch (err) {
    console.error('getWasteRequests hatası:', err);
    res.status(500).json({ message: 'Evsel atık talepleri getirilirken bir sunucu hatası oluştu.', error: err.message });
  }
};

const updateWasteStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, earnedCoins, weight } = req.body;

    const validStatuses = ['PENDING', 'ON_ROUTE', 'COLLECTED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Geçersiz talep durumu.' });
    }

    const existingRequest = await prisma.wasteRequest.findUnique({
      where: { id }
    });
    if (!existingRequest) {
      return res.status(404).json({ message: 'Evsel atık talebi bulunamadı.' });
    }

    let updateData = { status };
    let finalWeight = parseFloat(weight);
    let finalCoins = parseInt(earnedCoins);

    if (status === 'COLLECTED') {
      if (isNaN(finalCoins) || finalCoins === undefined || finalCoins === null) {
        if (existingRequest.wasteType === 'DOMESTIC') finalCoins = 50;
        else if (existingRequest.wasteType === 'ELECTRONIC') finalCoins = 100;
        else if (existingRequest.wasteType === 'PLASTIC') finalCoins = 30;
        else finalCoins = 50;
      }
      updateData.earnedCoins = finalCoins;
      
      if (!finalWeight || isNaN(finalWeight) || finalWeight <= 0) {
        if (existingRequest.wasteType === 'DOMESTIC') finalWeight = 5.0;
        else if (existingRequest.wasteType === 'ELECTRONIC') finalWeight = 10.0;
        else if (existingRequest.wasteType === 'PLASTIC') finalWeight = 3.0;
        else finalWeight = 5.0; // General / other
      }
      updateData.weight = finalWeight;
    }

    const updatedRequest = await prisma.wasteRequest.update({
      where: { id },
      data: updateData,
      include: {
        user: true
      }
    });

    if (status === 'COLLECTED' && finalCoins > 0) {
      // Cüzdanı bul veya oluştur
      await prisma.wallet.upsert({
        where: { userId: updatedRequest.userId },
        update: { balance: { increment: finalCoins } },
        create: { userId: updatedRequest.userId, balance: finalCoins }
      });

      let trCategory = 'Genel';
      if (updatedRequest.wasteType === 'DOMESTIC') trCategory = 'Organik';
      else if (updatedRequest.wasteType === 'ELECTRONIC') trCategory = 'Elektronik';
      else if (updatedRequest.wasteType === 'PLASTIC') trCategory = 'Plastik';
      else if (updatedRequest.wasteType === 'GLASS') trCategory = 'Cam';
      else if (updatedRequest.wasteType === 'PAPER') trCategory = 'Kağıt';

      // İşlem geçmişine ekle
      await prisma.transaction.create({
        data: {
          amount: finalCoins,
          type: 'EARNED',
          description: `Evsel Atık Geri Dönüşüm Ödülü (${finalWeight.toFixed(1)}kg) [${trCategory}]`,
          userId: updatedRequest.userId
        }
      });
    }

    // Dosya yedeklemesini güncelle
    await backupWasteRequests();

    // WebSocket üzerinden tüm bağlı istemcilere talep durumunun değiştiğini bildir
    if (global.wss) {
      global.wss.clients.forEach(client => {
        if (client.readyState === 1) { // 1 = OPEN
          client.send(JSON.stringify({ type: 'wasteRequestStatusChanged', data: updatedRequest }));
        }
      });
    }

    res.status(200).json({
      message: 'Evsel atık talebi durumu başarıyla güncellendi.',
      data: updatedRequest
    });
  } catch (err) {
    console.error('updateWasteStatus hatası:', err);
    res.status(500).json({ message: 'Evsel atık talebi güncellenirken bir sunucu hatası oluştu.', error: err.message });
  }
};

module.exports = {
  createWasteRequest,
  getWasteRequests,
  updateWasteStatus,
  updateWasteRequestStatus: updateWasteStatus // DatabaseService.ts ile uyum için alias
};
