module.exports.checkLogin = (req, res, next) => {
  if (req.session.user) {
    return res.redirect("/");
  }
  next();
};

module.exports.checkSession = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/auth/login");
  }
  if (req.session.user.status) {
    return res.redirect("/");
  }
  next();
};
