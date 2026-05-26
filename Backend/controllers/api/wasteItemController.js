const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_WASTE_ITEMS = [
  { name: 'Plastik Kapak', icon: 'database', library: 'MaterialCommunityIcons', coins: 2, color: '#06b6d4', description: 'Renkli kapaklar tekerlekli sandalye gibi projelere kaynak olur.' },
  { name: 'Kağıt', icon: 'file-alt', library: 'FontAwesome5', coins: 3, color: '#f59e0b', description: 'Kağıt atıklar ormanlarımızı korur ve enerji tasarrufu sağlar.' },
  { name: 'Naylon Poşet', icon: 'bag', library: 'SimpleLineIcons', coins: 3, color: '#94a3b8', description: 'Naylon poşetler doğada çok geç çözünür, mutlaka geri dönüştürülmelidir.' },
  { name: 'Karton', icon: 'box-open', library: 'FontAwesome5', coins: 4, color: '#8b4513', description: 'Karton ambalajlar geri kazanılarak yeni koli ve kutulara dönüşür.' },
  { name: 'Cam Kavanoz', icon: 'jar', library: 'FontAwesome6', coins: 4, color: '#475569', description: 'Cam kavanozlar sterilize edilerek tekrar kullanılabilir veya geri dönüştürülebilir.' },
  { name: 'Pet Şişe', icon: 'bottle-water', library: 'FontAwesome6', coins: 5, color: '#3b82f6', description: 'Plastik pet şişeler geri dönüştürülerek yeni tekstil ürünleri ve ambalajlar üretilir.' },
  { name: 'Floresan Lamba', icon: 'lightbulb-variant-outline', library: 'MaterialCommunityIcons', coins: 5, color: '#f43f5e', description: 'Aydınlatma ürünleri içerdikleri civa nedeniyle özel işlemlerle geri dönüştürülmelidir.' },
  { name: 'Metal Kutu', icon: 'can-food', library: 'FontAwesome6', coins: 7, color: '#64748b', description: 'Alüminyum içecek kutuları %100 geri dönüştürülebilir.' },
  { name: 'Cam Şişe', icon: 'wine-bottle', library: 'FontAwesome6', coins: 8, color: '#10b981', description: 'Cam sonsuz kez geri dönüştürülebilir ve doğaya zarar vermez.' },
  { name: 'Atık Lastik', icon: 'tire', library: 'MaterialCommunityIcons', coins: 10, color: '#4b5563', description: 'Kullanım ömrünü tamamlamış lastikler, asfalt ve zemin kaplama malzemelerine dönüştürülür.' },
  { name: 'Tekstil', icon: 'tshirt', library: 'FontAwesome5', coins: 12, color: '#ec4899', description: 'Eski kıyafetler yalıtım malzemesi veya yeni iplik olabilir.' },
  { name: 'Pil', icon: 'battery-charging-100', library: 'MaterialCommunityIcons', coins: 15, color: '#ef4444', description: 'Atık pillerdeki ağır metaller toprağa karışmadan toplanmalıdır.' },
  { name: 'Ahşap', icon: 'fence', library: 'MaterialCommunityIcons', coins: 15, color: '#a855f7', description: 'Ahşap parçaları mobilya veya yakacak peleti olur.' },
  { name: 'Bitkisel Yağ', icon: 'tint', library: 'FontAwesome5', coins: 20, color: '#d97706', description: 'Atık yağlar biyodizel yakıta dönüştürülür.' },
  { name: 'E-Atık', icon: 'laptop', library: 'FontAwesome5', coins: 50, color: '#6366f1', description: 'Eski elektronik cihazlar değerli madenler içerir.' },
  { name: 'Diğer Geri Dönüştürülebilir Atıklar', icon: 'recycle', library: 'FontAwesome5', coins: 5, color: '#14b8a6', description: 'Listede olmayan diğer geri dönüştürülebilir atıklar.' },
];

let isSeeding = false;

const seedWasteItems = async () => {
  if (isSeeding) {
    // Eğer halihazırda başka bir istek tabloyu dolduruyorsa, kısa bir süre bekle ve çık.
    await new Promise(resolve => setTimeout(resolve, 500));
    return;
  }
  
  try {
    isSeeding = true;
    const count = await prisma.wasteItem.count();
    if (count === 0) {
      const itemsToCreate = DEFAULT_WASTE_ITEMS.map((item, index) => ({
        ...item,
        row: Math.floor(index / 3),
        column: index % 3,
      }));
      await prisma.wasteItem.createMany({ data: itemsToCreate });
    }
  } finally {
    isSeeding = false;
  }
};

exports.getWasteItems = async (req, res) => {
  try {
    await seedWasteItems();
    const items = await prisma.wasteItem.findMany({
      orderBy: [
        { row: 'asc' },
        { column: 'asc' },
      ],
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createWasteItem = async (req, res) => {
  try {
    const { name, coins, color, description, imageUrl, icon, library, row, column } = req.body;
    
    // Calculate next available row/column if not provided
    let newRow = row;
    let newColumn = column;
    if (newRow === undefined || newColumn === undefined) {
      const lastItem = await prisma.wasteItem.findFirst({
        orderBy: [{ row: 'desc' }, { column: 'desc' }]
      });
      if (lastItem) {
        if (lastItem.column >= 2) {
          newRow = lastItem.row + 1;
          newColumn = 0;
        } else {
          newRow = lastItem.row;
          newColumn = lastItem.column + 1;
        }
      } else {
        newRow = 0;
        newColumn = 0;
      }
    }

    const newItem = await prisma.wasteItem.create({
      data: {
        name,
        coins: parseInt(coins),
        color: color || '#14b8a6',
        description,
        imageUrl,
        icon: icon || 'recycle',
        library: library || 'FontAwesome5',
        row: newRow,
        column: newColumn,
      },
    });
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateWasteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, coins, color, description, imageUrl, icon, library, row, column } = req.body;
    const updated = await prisma.wasteItem.update({
      where: { id },
      data: {
        name,
        coins: coins ? parseInt(coins) : undefined,
        color,
        description,
        imageUrl,
        icon,
        library,
        row,
        column,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateWasteItemsBulk = async (req, res) => {
  try {
    const { items } = req.body; // Array of { id, row, column }
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Geçersiz veri formatı' });
    }

    const updatePromises = items.map(item => 
      prisma.wasteItem.update({
        where: { id: item.id },
        data: { row: item.row, column: item.column }
      })
    );

    await Promise.all(updatePromises);
    res.json({ success: true, message: 'Öğeler güncellendi' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteWasteItem = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.wasteItem.delete({ where: { id } });

    // Silme sonrası kalan itemların row/column değerlerini boşluksuz yeniden hesapla
    const remaining = await prisma.wasteItem.findMany({
      orderBy: [{ row: 'asc' }, { column: 'asc' }],
    });

    const updatePromises = remaining.map((item, index) =>
      prisma.wasteItem.update({
        where: { id: item.id },
        data: {
          row: Math.floor(index / 3),
          column: index % 3,
        },
      })
    );
    await Promise.all(updatePromises);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
