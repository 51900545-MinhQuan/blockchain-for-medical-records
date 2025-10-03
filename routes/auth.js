const express = require('express');
const argon2 = require('argon2');
const { check, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');

const router = express.Router();

// Import Model
const UserModel = require('../models/user');

// Import Middleware
const Auth = require('../middleware/auth');

// Import Validators
const RegisterValidator = require('./validators/register');
const LoginValidator = require('./validators/login');
const ResetPasswordValidator = require('./validators/reset-password');

/*
|------------------------------------------------------------------------------------------------------
| ĐĂNG NHẬP TÀI KHOẢN NGƯỜI DÙNG
|------------------------------------------------------------------------------------------------------
*/
router.get('/login', Auth.checkLogin, async (req, res, next) => {
  try {
    var user = await UserModel.findOne({ email: 'admin@gmail.com' }).exec();  // Tạo tài khoản admin mặc định
    if (!user) {
      var password = 'Admin123.';
      var hashed = await argon2.hash(password);
      await UserModel.create({ fullname: 'Quản trị viên', email: 'admin@gmail.com', birthday: null, phone: null, address: null, password: hashed, role: 0 }).exec();
    }

    res.render('auth/login', {
      error: req.flash('error') || '',
      email: req.flash('email') || '',
    });
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});

router.post('/login', LoginValidator, async (req, res, next) => {
  try {
    var result = validationResult(req);
    var { email, password } = req.body;

    if (result.errors.length !== 0) {
      result = result.mapped();
      for (fields in result) {
        req.flash('error', result[fields].msg);
        return res.redirect('/auth/login');
      }
    }

    var user = await UserModel.findOne({ email }).exec();
    if (!user) {
      req.flash('error', 'Email hoặc mật khẩu không tồn tại!');
      return res.redirect('/auth/login');
    }

    var matched = await argon2.verify(user.password, password);
    if (!matched) {
      req.flash('error', 'Email hoặc mật khẩu không tồn tại!');
      return res.redirect('/auth/login');
    }

    req.session.user = {
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      birthday: user.birthday,
      phone: user.phone,
      address: user.address,
      role: user.role,
    };

    if (req.session.user.role == 0) {
      return res.redirect('/admin');
    }

    return res.redirect('/');
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});

/*
|------------------------------------------------------------------------------------------------------
| ĐĂNG KÝ TÀI KHOẢN NGƯỜI DÙNG
|------------------------------------------------------------------------------------------------------
*/
router.get('/register', Auth.checkLogin, async (req, res, next) => {
  try {
    res.render('auth/register', {
      error: req.flash('error') || '',
      fullname: req.flash('fullname') || '',
      email: req.flash('email') || '',
      birthday: req.flash('birthday') || '',
      phone: req.flash('phone') || '',
      address: req.flash('address') || '',
    });
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});

router.post('/register', RegisterValidator, async (req, res, next) => {
  try {
    var result = validationResult(req);
    console.log(req.body);
    var { fullname, email, password, confirmPassword, birthday, phone, address, role } = req.body;


    if (result.errors.length !== 0) {
      result = result.mapped();
      for (fields in result) {
        req.flash('error', result[fields].msg);
        return res.redirect('/auth/register');
      }
    } 

    if (!req.body) {
      req.flash('error', 'Invalid request. Please try again.');
      return res.redirect('/auth/register');
    }
    


    if (await UserModel.findOne({ email }).exec()) {
      req.flash('error', 'Địa chỉ Email đã tồn tại');
      return res.redirect('/auth/register');
    }

    if (password !== confirmPassword) {
      req.flash('error', 'Mật khẩu không trùng khớp')
      return res.redirect('/auth/register');
    }

    if (await UserModel.findOne({ phone }).exec()) {
      req.flash('error', 'Số điện thoại đã tồn tại!');
      return res.redirect('/auth/register');
    }
    
    var hashed = await argon2.hash(password);
    // If role is '2' (from checkbox), use it. Otherwise, default to 1 (patient).
    const userRole = role === '2' ? 2 : 1;

    await UserModel.create({ fullname, email, birthday, phone, address, password: hashed, role: userRole });
    
    req.flash('success', "Đăng ký tài khoản thành công!");
    return res.redirect('/auth/login');
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});


/*
|------------------------------------------------------------------------------------------------------
| Đặt lại mật khẩu (tạm thời bỏ qua chức năng này)
|------------------------------------------------------------------------------------------------------
*/
router.get('/reset-password', (req, res, next) => {
  try {
    res.render('auth/reset-password', {
      error: req.flash('error') || '',
      email: req.flash('email') || '',
    });
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});

router.post('/reset-password', ResetPasswordValidator, async (req, res, next) => {
  try {
    var result = validationResult(req);
    var { email } = req.body;

    req.flash('email', email);

    if (result.errors.length !== 0) {
      result = result.mapped();
      for (fields in result) {
        req.flash('error', result[fields].msg);
        return res.redirect('/auth/reset-password');
      }
    }

    var user = await UserModel.findOne({ email }).exec();

    if (!user) {
      req.flash('error', 'Đỉa chỉ email không tồn tại!');
      return res.redirect('/auth/reset-password');
    }

    var password = Math.random().toString(36).slice(-6);
    password = password.charAt(0).toUpperCase() + password.slice(1) + '1@';
    var hashed = await argon2.hash(password);

    const updatedUser = await UserModel.findByIdAndUpdate(user.id, { password: hashed }).exec();
    if (!updatedUser) {
      req.flash('error', 'Lỗi trong quá trình xử lý, không tìm thấy người dùng để cập nhật!');
      return res.redirect('/auth/reset-password');
    }


    var transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    transporter.sendMail({
      from: process.env.mailUser,
      to: `${email}`,
      subject: '[TB] THÔNG TIN TÀI KHOẢN KHÁCH HÀNG - BỆNH VIỆN XXXXXX',
      html: `<p>Vui lòng không chia sẻ thông tin này đến bất kỳ ai. 
      Đây là thông tin tài khoản của bạn sau khi đặt lại mật khẩu:</p>
      <b>Tên khách hàng: </b>${user.fullname} <br> 
      <b>Địa chỉ email: </b>${user.email} <br> 
      <b>Mật khẩu mới: </b>${password} 
      <p>Trân trọng ./.</p>`,
    });

    console.log("debug 5");

    req.flash('success', 1);
    return res.redirect('/auth/email');
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Tạm thời bỏ qua chức năng này' }, message: 'Connection errors' });
  }
});

/*
|------------------------------------------------------------------------------------------------------
| ĐĂNG XUẤT TÀI KHOẢN NGƯỜI DÙNG
|------------------------------------------------------------------------------------------------------
*/
router.get('/logout', (req, res, next) => {
  try {
    req.session.destroy();
    res.redirect('/auth/login');
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});

module.exports = router;
