const {PrismaClient} = require("@prisma/client");

const prisma = new PrismaClient();

const getUsers =  async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.status(200).json({
      message: "success",
      data: users
    })
  } catch (err) {
    res.status(500).json({
      message: "Kullanıcılar getirilemedi.",
      error: err.message
    })
  }
}

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
module.exports = {
  getUsers,
  updateWorkRegion,
  deleteUser,
};
