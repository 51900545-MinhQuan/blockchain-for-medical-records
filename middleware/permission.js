module.exports.Admin = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    if (req.session.user.role > 0) {
        return res.redirect('/');
    }
    next();
}

module.exports.User = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    if (req.session.user.role > 2) {
        return res.redirect('/auth/logout');
    }
    next();
}
