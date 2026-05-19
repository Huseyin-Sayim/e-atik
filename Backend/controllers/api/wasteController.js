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
      return res.status(200).json({
        message: 'Evsel atık talepleri başarıyla getirildi.',
        data: requests
      });
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

    res.status(200).json({
      message: 'Evsel atık talepleri başarıyla getirildi.',
      data: requests
    });
  } catch (err) {
    console.error('getWasteRequests hatası:', err);
    res.status(500).json({ message: 'Evsel atık talepleri getirilirken bir sunucu hatası oluştu.', error: err.message });
  }
};

// Evsel Atık Talebi Durumunu Güncelle (Yol Tarifi Alma veya Toplanma durumları için)
const updateWasteStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'ON_ROUTE', 'COLLECTED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Geçersiz talep durumu.' });
    }

    const updatedRequest = await prisma.wasteRequest.update({
      where: { id },
      data: {
        status
      },
      include: {
        user: true
      }
    });

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
  updateWasteStatus
};
