module.exports.Admin = (req, res, next) => {
  if (req.session.user.role === 0) {
    return next();
  }
  return res.redirect(req.session.user.role === 2 ? "/doctor" : "/");
};

module.exports.User = (req, res, next) => {
  if (req.session.user.role <= 1) {
    return next();
  }
  return res.redirect("/doctor");
};

module.exports.Doctor = (req, res, next) => {
  if (req.session.user.role === 2) {
    return next();
  }
  return res.redirect(req.session.user.role === 0 ? "/admin" : "/");
};

module.exports.requireWallet = (req, res, next) => {
  if (req.session.user && req.session.user.walletAddress) {
    return next();
  }
  req.flash(
    "errors",
    "Vui lòng liên kết ví MetaMask để sử dụng chức năng này."
  );
  return res.redirect("/doctor/patients");
};
