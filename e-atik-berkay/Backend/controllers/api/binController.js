const { PrismaClient } = require('@prisma/client');


const prisma = new PrismaClient();

const getBins = async (req, res) => {
  try {
    const bins = await prisma.bin.findMany();
    res.status(200).json(bins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const createBin = async (req, res) => {
  try {
    const { latitude, longitude, wasteCategory, type, capacityVolume, regionId } = req.body;
    const region = await prisma.region.findFirst({
      where: {
        region_id: regionId
      }
    })

    await prisma.bin.create({
      data: {
        latitude,
        longitude,
        wasteCategory,
        type,
        capacityVolume,
        regionId : region.id
      }
    })

    res.status(201).json({ message: 'Çöp Kutusu başarıyla oluşturuldu.' })
    console.log(req.body)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const deleteBin = async (req, res) => {
  try {

  } catch (err) {

  }
}

module.exports = {
  getBins,
  createBin,
  deleteBin
}