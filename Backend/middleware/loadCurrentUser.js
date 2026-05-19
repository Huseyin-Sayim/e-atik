const { PrismaClient } = require('@prisma/client');
const { getUserInitials } = require('../utils/userInitials');

const prisma = new PrismaClient();

const loadCurrentUser = async (req, res, next) => {
  try {
    if (!req.user?.userId) {
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        name: true,
        email: true,
        role: true,
        employeeType: true,
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

    res.locals.user = user;
    res.locals.userInitials = getUserInitials(user?.name);
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = loadCurrentUser;
