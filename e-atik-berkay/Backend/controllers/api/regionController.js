const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const getDBRegions = async (req, res) => {
  const region = await prisma.region.findMany();
  return res.json({
    region
  })
}

const getRegion = async (req, res) => {
  try {
    const filePath = path.join(__dirname, '..', '..', 'public', 'data', 'geojson', 'kampusParsel.geojson');
    const { area } = req.params;

    fs.readFile(filePath, 'utf8', (err, data)  => {
      if (err) {
        console.log(err.message)
        return res.status(400).json({
          message: 'Dosya okunamadı' + err.message
        })
      }

      const geo = JSON.parse(data);
      let parcel = geo;

      if (area) {
        geo.features.forEach((item, index) => {
          if (item.id === area) {
            console.log(item.properties.name)
            parcel = item;
          }
        })
      }

      return res.status(200).json({
        message: 'OK',
        data: parcel
      })

    })
  } catch (err) {
    res.status(500).json({
      message: "Hata " + err.message
    })
  }
}

const createRegion = async (req, res) => {
  try {
    const { name, region_id } = req.body;

    if (!name || !region_id) {
      return res.status(400).json({
        message: 'Eksik parametre'
      })
    }

    await prisma.region.create({
      data: {
        name: name,
        region_id: region_id
      }
    })

    return res.status(201).json({
      message: 'Bölge başarıyla eklendi'
    })

  } catch (err) {
    return res.status(500).json({
      message: err.message
    })
  }
}

module.exports = {
  getRegion,
  createRegion,
  getDBRegions
}