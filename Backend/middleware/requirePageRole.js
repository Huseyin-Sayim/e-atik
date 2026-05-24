const requirePageRole = (...allowedRoles) => {
  return (req, res, next) => {
    const role = res.locals.user?.role;
    if (!role || !allowedRoles.includes(role)) {
      return res.redirect('/dashboard');
    }
    next();
  };
};

module.exports = requirePageRole;
