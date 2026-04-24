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

module.exports = {
  getUsers
}