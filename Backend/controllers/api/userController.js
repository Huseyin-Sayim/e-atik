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
    const { email, profileImage, profileType, name, surname, city, district } = req.body;
    const updatedUser = await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: {
        ...(profileImage !== undefined && { profileImage }),
        ...(profileType && { profileType }),
        ...(name && { name }),
        ...(surname && { surname }),
        ...(city && { city }),
        ...(district && { district })
      }
    });
    res.status(200).json({
      message: "Profil başarıyla güncellendi.",
      data: updatedUser
    });
  } catch (err) {
    res.status(500).json({ message: "Profil güncellenirken bir hata oluştu." });
  }
}

const getUserProfile = async (req, res) => {
  try {
    const {userId} = req.user; // isAuth middleware'inden geliyor
    const user = await prisma.user.findUnique({
      where: { id: userId }
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

module.exports = {
  getUsers,
  deleteUser,
  updateProfile,
  getUserProfile
}