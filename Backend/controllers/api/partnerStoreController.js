const fs = require('fs');
const path = require('path');
const { crypto } = require('crypto');

const backupPath = path.join(__dirname, '../../data-backups/partner-stores-backup.json');

// Get all partner stores
const getPartnerStores = async (req, res) => {
  try {
    if (fs.existsSync(backupPath)) {
      const raw = fs.readFileSync(backupPath, 'utf-8');
      const stores = JSON.parse(raw);
      return res.status(200).json(stores);
    }
    
    // Return empty array if file does not exist
    return res.status(200).json([]);
  } catch (err) {
    console.error('getPartnerStores error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Add/Create a partner store
const addPartnerStore = async (req, res) => {
  try {
    const { name, latitude, longitude } = req.body;
    if (!name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Name, latitude, and longitude are required.' });
    }

    let stores = [];
    if (fs.existsSync(backupPath)) {
      const raw = fs.readFileSync(backupPath, 'utf-8');
      stores = JSON.parse(raw);
    }

    const newStore = {
      id: Date.now().toString(),
      name,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    };

    stores.push(newStore);
    
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    fs.writeFileSync(backupPath, JSON.stringify(stores, null, 2), 'utf-8');

    res.status(201).json(newStore);
  } catch (err) {
    console.error('addPartnerStore error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete a partner store
const deletePartnerStore = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Store ID is required.' });
    }

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'No stores backup file found.' });
    }

    const raw = fs.readFileSync(backupPath, 'utf-8');
    let stores = JSON.parse(raw);

    const initialLength = stores.length;
    stores = stores.filter(store => store.id !== id);

    if (stores.length === initialLength) {
      return res.status(404).json({ error: 'Store not found.' });
    }

    fs.writeFileSync(backupPath, JSON.stringify(stores, null, 2), 'utf-8');
    res.status(200).json({ message: 'Store successfully deleted.' });
  } catch (err) {
    console.error('deletePartnerStore error:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getPartnerStores,
  addPartnerStore,
  deletePartnerStore
};
