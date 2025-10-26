const express = require('express');
const { check, validationResult } = require('express-validator');
const argon2 = require('argon2');

const router = express.Router();

// Import Model
const UserModel = require('../models/user');
const PatientModel = require('../models/patient');
const MedicalRecordModel = require('../models/medical-record');

// Import Validators
const ChangePasswordValidator = require('./validators/change-password');
const UpdateProfileValidator = require('./validators/update-profile');
const UpdatePatientProfileValidator = require('./validators/update-patient-profile'); // New validator

/*
|------------------------------------------------------------------------------------------------------
| TRANG TỔNG QUAN
|------------------------------------------------------------------------------------------------------
*/

router.get('/', function (req, res, next) {
  try {
    if (req.session.user.role === 0) {
      return res.redirect('/admin');
    }
    if (req.session.user.role === 2) {
      return res.redirect('/doctor');
    }
    
    res.render('user/index', {
      user: req.session.user,
      errors: req.flash('error') || '',
      success: req.flash('success') || '',
    });
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});


/*
|------------------------------------------------------------------------------------------------------
| XEM HỒ SƠ BỆNH ÁN (CHO BỆNH NHÂN)
|------------------------------------------------------------------------------------------------------
*/

router.get('/medical-history', async (req, res) => {
  try {
    const patient = await PatientModel.findOne({ linkedUserID: req.session.user.id });

    if (!patient) {
      req.flash('error', 'Không tìm thấy hồ sơ bệnh nhân được liên kết với tài khoản của bạn.');
      return res.redirect('/');
    }

    const medicalRecords = await MedicalRecordModel.find({ patientID: patient._id })
      .populate('doctorID', 'fullname')
      .sort({ visitDate: -1 });

    res.render('user/patient-detail', {
      user: req.session.user,
      patient,
      medicalRecords,
      success: req.flash('success') || '',
      errors: req.flash('error') || '',
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Có lỗi xảy ra khi truy vấn thông tin bệnh nhân.');
    res.redirect('/');
  }
});

router.get('/medical-record/:id', async (req, res) => {
  try {
    const record = await MedicalRecordModel.findById(req.params.id)
      .populate('patientID')
      .populate('doctorID', 'fullname');

    if (!record) {
      req.flash('error', 'Không tìm thấy bệnh án.');
      return res.redirect('/medical-history');
    }

    // Kiểm tra xem bệnh nhân có quyền xem bệnh án này không
    const patient = await PatientModel.findOne({ linkedUserID: req.session.user.id });
    if (!patient || !record.patientID.equals(patient._id)) {
      req.flash('error', 'Bạn không có quyền xem bệnh án này.');
      return res.redirect('/medical-history');
    }

    res.render('user/record-detail', {
      user: req.session.user,
      record,
      success: req.flash('success') || '',
      errors: req.flash('error') || '',
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Có lỗi xảy ra khi truy vấn thông tin bệnh án.');
    res.redirect('/medical-history');
  }
});

/*
|------------------------------------------------------------------------------------------------------
| CHỈNH SỬA THÔNG TIN BỆNH NHÂN (CHO BỆNH NHÂN)
|------------------------------------------------------------------------------------------------------
*/

router.get('/medical-history/edit', async (req, res) => {
  try {
    const patient = await PatientModel.findOne({ linkedUserID: req.session.user.id });
    if (!patient) {
      req.flash('error', 'Không tìm thấy hồ sơ bệnh nhân.');
      return res.redirect('/medical-history');
    }
    res.render('user/edit-patient-detail', {
      user: req.session.user,
      patient,
      errors: req.flash('error') || '',
      success: req.flash('success') || ''
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Có lỗi xảy ra.');
    res.redirect('/medical-history');
  }
});

router.post('/medical-history/edit', UpdatePatientProfileValidator, async (req, res) => {
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      req.flash('error', result.array().map(e => e.msg).join(', '));
      return res.redirect('/medical-history/edit');
    }

    const patient = await PatientModel.findOne({ linkedUserID: req.session.user.id });
    if (!patient) {
      req.flash('error', 'Không tìm thấy hồ sơ bệnh nhân.');
      return res.redirect('/medical-history');
    }

    const {
      email, phone, address,
      allergies, chronicDiseases,
      guardianName, guardianPhone, guardianIDNumber
    } = req.body;

    // Cập nhật thông tin bệnh nhân
    patient.email = email;
    patient.phone = phone;
    patient.address = address;
    patient.allergies = allergies;
    patient.chronicDiseases = chronicDiseases;
    patient.guardianName = guardianName;
    patient.guardianPhone = guardianPhone;
    patient.guardianIDNumber = guardianIDNumber;

    await patient.save();

    req.flash('success', 'Cập nhật thông tin thành công!');
    res.redirect('/medical-history');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Có lỗi xảy ra khi cập nhật thông tin.');
    res.redirect('/medical-history/edit');
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
      errors: req.flash('error') || '',
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
    );

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
      errors: req.flash('errors') || [],
      success: req.flash('success') || [],
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
    const result = validationResult(req);
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (result.errors.length !== 0) {
      req.flash('errors', result.errors[0].msg);
      return res.redirect('/change-password');
    }

    if (newPassword !== confirmPassword) {
      req.flash('errors', 'Mật khẩu xác nhận không trùng khớp!');
      return res.redirect('/change-password');
    }

    const user = await UserModel.findById(req.session.user.id);
    if (!user) {
      req.flash('errors', 'Lỗi trong quá trình xữ lý, vui lòng thử lại!');
      return res.redirect('/change-password');
    }

    const matched = await argon2.verify(user.password, oldPassword);
    
    if (!matched) {
      req.flash('errors', 'Mật khẩu cũ không đúng!');
      return res.redirect('/change-password');
    }
    user.password = await argon2.hash(newPassword);
    await user.save();

    req.flash('success', "Cập nhật mật khẩu thành công!");
    res.redirect('/change-password');
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});

module.exports = router;
