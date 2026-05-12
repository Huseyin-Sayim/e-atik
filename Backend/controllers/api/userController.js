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
    const { email, profileImage, profileType } = req.body;
    const updatedUser = await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: {
        ...(profileImage && { profileImage }),
        ...(profileType && { profileType })
      }
    });
    res.status(200).json({
      message: "success",
      data: updatedUser
    });
  } catch (err) {
    res.status(500).json({ message: "hata" });
  }
}

module.exports = {
  getUsers,
  deleteUser,
  updateProfile
}