const express = require('express');
const { check, validationResult } = require('express-validator');
const argon2 = require('argon2');

const router = express.Router();

// Import Model
const UserModel = require('../models/user');

// Import Middleware
const Auth = require('../middleware/auth');

// Import Validators
const ChangePasswordValidator = require('./validators/change-password');
const UpdateProfileValidator = require('./validators/update-profile');

/*
|------------------------------------------------------------------------------------------------------
| TRANG TỔNG QUAN
|------------------------------------------------------------------------------------------------------
*/

router.get('/', function (req, res, next) {
  try {
    if(!req.session.user) {
      return res.redirect('/auth/login');
    }
    if (req.session.user.role == 0) {
      return res.redirect('/admin');
    }
    
    res.render('user/index', {
      user: req.session.user,
      error: req.flash('error') || '',
    });
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});

/*
|------------------------------------------------------------------------------------------------------
| THÔNG TIN TÀI KHOẢN
|------------------------------------------------------------------------------------------------------
*/

router.get('/profile', function (req, res, next) {
  try {
    res.render('user/profile', {
      user: req.session.user,
      success: req.flash('success') || '',
      error: req.flash('error') || '',
    });
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});

router.post('/profile', UpdateProfileValidator, async function (req, res, next) {
  try {
    const result = validationResult(req);
    if (result.errors.length > 0) {
      req.flash('error', result.errors[0].msg);
      return res.redirect('/profile');
    }

    const { fullname, birthday, phone, address } = req.body;

    const updatedUser = await UserModel.findByIdAndUpdate(
      req.session.user.id,
      { fullname, birthday, phone, address },
      { new: true }
    ).exec();

    if (!updatedUser) {
      req.flash('error', 'Không tìm thấy người dùng để cập nhật.');
      return res.redirect('/profile');
    }

    req.session.user.fullname = updatedUser.fullname;
    req.session.user.birthday = updatedUser.birthday;
    req.session.user.phone = updatedUser.phone;
    req.session.user.address = updatedUser.address;

    req.flash('success', 'Cập nhật thông tin tài khoản thành công!');
    res.redirect('/profile');
  } catch (error) {
    console.error(error);
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});


/*
|------------------------------------------------------------------------------------------------------
| ĐỔI MẬT KHẨU
|------------------------------------------------------------------------------------------------------
*/
router.get('/change-password', function (req, res, next) {
  try {
    res.render('user/change-password', {
      user: req.session.user,
      error: req.flash('error') || '',
      success: req.flash('success') || '',
      oldPassword: req.flash('oldPassword') || '',
      newPassword: req.flash('newPassword') || '',
      confirmPassword: req.flash('confirmPassword') || '',
    });
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});

router.post('/change-password', ChangePasswordValidator, async function (req, res, next) {
  try {
    var result = validationResult(req);
    var { oldPassword, newPassword, confirmPassword } = req.body;
    
    req.flash('oldPassword', oldPassword);
    req.flash('newPassword', newPassword);
    req.flash('confirmPassword', confirmPassword);

    if (result.errors.length !== 0) {
      result = result.mapped();
      for (fields in result) {
        req.flash('error', result[fields].msg);
        return res.redirect('/change-password');
      }
    }

    var user = await UserModel.findById(req.session.user.id).exec();
    if (!user) {
      req.flash('error', 'Lỗi trong quá trình xữ lý, vui lòng thử lại!');
      return res.redirect('/change-password');
    }

    var matched = await argon2.verify(user.password, oldPassword);
    
    if (!matched) {
      req.flash('error', 'Mật khẩu cũ không đúng!');
      return res.redirect('/change-password');
    }

    if (newPassword !== confirmPassword) {
      req.flash('error', 'Mật khẩu xác nhận không trùng khớp!')
      return res.redirect('/change-password');
    }

    var hashed = await argon2.hash(newPassword);

    const updatedUser = await UserModel.findByIdAndUpdate(user.id, { password: hashed }).exec();
    if (!updatedUser) {
      req.flash('error', 'Lỗi trong quá trình xử lý, không tìm thấy người dùng để cập nhật!');
      return res.redirect('/change-password');
    }

    req.flash('success', "Cập nhật mật khẩu thành công!");
    res.redirect('/change-password');
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});

module.exports = router;
