const express = require('express');
const { validationResult } = require('express-validator');
const argon2 = require('argon2');
const router = express.Router();
const moment = require('moment');

// Import Models
const UserModel = require('../models/user'); 
const PatientModel = require('../models/patient');
const MedicalRecordModel = require('../models/medical-record');

// Import Validators
const ChangePasswordValidator = require('./validators/change-password');
const CreatePatientValidator = require('./validators/create-patient');
const CreateRecordValidator = require('./validators/create-record');
const UpdateProfileValidator = require('./validators/update-profile');

/*
|------------------------------------------------------------------------------------------------------
| TRANG TỔNG QUAN
|------------------------------------------------------------------------------------------------------
*/

router.get('/', function (req, res, next) {
  try {
    var user = req.session.user;
    return res.render('doctor/index', {
      user, errors: req.flash('errors') || '',
      success: req.flash('success') || '',
    });
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});

/*
|------------------------------------------------------------------------------------------------------
| HIỂN THỊ DANH SÁCH BỆNH NHÂN
|------------------------------------------------------------------------------------------------------
*/

router.get('/patients', async (req, res) => {
  const { keyword, gender, fromDate, toDate, page = 1, limit = 10 } = req.query;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) return res.redirect('/doctor/patients');

  // Xây dựng truy vấn tìm kiếm
  const query = {};

  if (keyword) {
    query.$or = [
      { fullname: new RegExp(keyword, 'i') },
      { email: new RegExp(keyword, 'i') },
      { phone: new RegExp(keyword, 'i') },
      { patientCode: new RegExp(keyword, 'i') },
    ];
  }

  if (fromDate || toDate) {
    query.created_at = {};
    if (fromDate) query.created_at.$gte = new Date(fromDate);
    if (toDate) query.created_at.$lte = new Date(toDate);
  }

  const totalPatients = await PatientModel.countDocuments(query);
  const patients = await PatientModel.find(query)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limitNum);

  const totalPages = Math.ceil(totalPatients / limitNum);

  res.render('doctor/patients', { 
    user: req.session.user, 
    success: req.flash('success') || '', 
    errors: req.flash('errors') || '',
    patients, keyword, gender, fromDate, toDate,
    currentPage: pageNum,
    totalPages: totalPages,
    limit: limitNum
  });
});

/*
|------------------------------------------------------------------------------------------------------
| TAO HỒ SƠ BỆNH NHÂN
|------------------------------------------------------------------------------------------------------
*/

router.get('/patients/create', (req, res, next) => {
  try {
    res.render('doctor/create-patient', {
      user: req.session.user,
      success: req.flash('success') || '',
      errors: req.flash('errors') || [],
      oldData: req.flash('oldData')[0] || {},
    });
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});

router.post('/patients/create', CreatePatientValidator, async (req, res, next) => {
    const { fullname, email, birthday, gender, phone, address, identificationNumber, guardianName, guardianPhone, guardianIDNumber, bloodType, allergies, chronicDiseases } = req.body;

    const flashAndRedirect = (errorMsg) => {
      req.flash('errors', errorMsg);
      req.flash('oldData', req.body);
      return res.redirect('/doctor/patients/create');
    };

    const result = validationResult(req);
    if (result.errors.length > 0) {
      return flashAndRedirect(result.errors[0].msg);
    }

    try {

      if (!identificationNumber && !guardianIDNumber) {
        return flashAndRedirect("Bệnh nhân phải có CMND/CCCD hoặc CCCD người giám hộ");
      }

      let newPatientCode = '';
      let attempts = 0;
      const MAX_ATTEMPTS = 5; // Tránh vòng lặp vô hạn trong trường hợp trùng mã liên tục

      // Tạo mã bệnh nhân duy nhất, thử lại nếu bị trùng
      while (attempts < MAX_ATTEMPTS) {
        const lastPatient = await PatientModel.findOne().sort({ patientCode: -1 });
        let nextCodeNumber;
        if (lastPatient && lastPatient.patientCode) {
          const lastCodeNumber = parseInt(lastPatient.patientCode.split('-')[1], 10);
          nextCodeNumber = lastCodeNumber + 1;
        } else {
          nextCodeNumber = 1;
        }
        newPatientCode = 'P-' + String(nextCodeNumber).padStart(8, '0');

        // Kiểm tra trùng mã
        const existingPatientWithCode = await PatientModel.findOne({ patientCode: newPatientCode });
        if (!existingPatientWithCode) break; 
        attempts++;
      }

      const patient = new PatientModel({
        patientCode: newPatientCode,
        fullname, email, birthday, gender, phone, address,
        identificationNumber, guardianName, guardianPhone, guardianIDNumber,
        bloodType, allergies, chronicDiseases,
      });
      
      await patient.save();
      req.flash('success', `Tạo hồ sơ bệnh nhân ${newPatientCode} thành công!`);
      return res.redirect('/doctor/patients');
    } catch (err) {
      if (err.code === 11000) { // Lỗi trùng key trong MongoDB
        return flashAndRedirect('Mã bệnh nhân hoặc thông tin duy nhất (email/CMND) đã được sử dụng. Vui lòng thử lại.');
      }
      console.error(err);
      return flashAndRedirect('Đã xảy ra lỗi khi tạo hồ sơ, vui lòng thử lại.');
    }
  }
);

/*
|------------------------------------------------------------------------------------------------------
| XEM CHI TIẾT HỒ SƠ BỆNH NHÂN
|------------------------------------------------------------------------------------------------------
*/

router.get('/patient/:id', async (req, res) => {
  try {
    const patient = await PatientModel.findById(req.params.id);
    if (!patient) {
      req.flash('errors', 'Không tìm thấy bệnh nhân.');
      return res.redirect('/doctor/patients');
    }

    const medicalRecords = await MedicalRecordModel.find({ patientID: req.params.id })
      .populate('doctorID', 'fullname')
      .sort({ visitDate: -1 });

    res.render('doctor/patient-detail', {
      user: req.session.user,
      patient,
      medicalRecords,
      success: req.flash('success') || '',
      errors: req.flash('errors') || '',
    });
  } catch (error) {
    console.error(error);
    req.flash('errors', 'Có lỗi xảy ra khi truy vấn thông tin bệnh nhân.');
    res.redirect('/doctor/patients');
  }
});

/*
|------------------------------------------------------------------------------------------------------
| XEM CHI TIẾT BỆNH ÁN
|------------------------------------------------------------------------------------------------------
*/

router.get('/medical-record/:id', async (req, res) => {
  try {
    const record = await MedicalRecordModel.findById(req.params.id)
      .populate('patientID')
      .populate('doctorID', 'fullname');

    if (!record) {
      req.flash('error', 'Không tìm thấy bệnh án.');
      return res.redirect('/doctor/patients');
    }

    res.render('doctor/record-detail', {
      user: req.session.user,
      record,
      success: req.flash('success') || '',
      errors: req.flash('errors') || '',
    });
  } catch (error) {
    console.error(error);
    req.flash('errors', 'Có lỗi xảy ra khi truy vấn thông tin bệnh án.');
    res.redirect('/doctor/patients');
  }
});

/*
|------------------------------------------------------------------------------------------------------
| HIỂN THỊ DANH SÁCH BỆNH ÁN
|------------------------------------------------------------------------------------------------------
*/

router.get('/records', async (req, res) => {
    try {
        const { filterDate, page = 1, limit = 10 } = req.query; // Lấy tham số lọc ngày, trang và giới hạn từ query
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) return res.redirect('/doctor/records');

        const query = {};
        let currentDateDisplay = 'Tất cả';

        if (filterDate && moment(filterDate, 'YYYY-MM-DD', true).isValid()) {
            const startOfDay = moment(filterDate).startOf('day').toDate();
            const endOfDay = moment(filterDate).endOf('day').toDate();
            query.visitDate = { $gte: startOfDay, $lte: endOfDay };
            currentDateDisplay = moment(filterDate).format('DD/MM/YYYY');
        }

        const totalRecords = await MedicalRecordModel.countDocuments(query);
        const records = await MedicalRecordModel.find(query)
            .populate('patientID', 'fullname patientCode')
            .populate('doctorID', 'fullname')
            .sort({ visitDate: -1 })
            .skip(skip)
            .limit(limitNum);

        const totalPages = Math.ceil(totalRecords / limitNum);

        res.render('doctor/records', {
            user: req.session.user,
            records: records,
            currentDate: currentDateDisplay,
            filterDate: filterDate,
            currentPage: pageNum,
            totalPages: totalPages,
            limit: limitNum,
            errors: req.flash('errors') || '',
            success: req.flash('success') || ''
        });
    } catch (error) {
        console.error(error);
        req.flash('errors', 'Không thể tải danh sách bệnh án.');
        res.redirect('/doctor');
    }
});

/*
|------------------------------------------------------------------------------------------------------
| TẠO BỆNH ÁN MỚI
|------------------------------------------------------------------------------------------------------
*/

router.get('/medical-records/create', async (req, res) => {
  try {
    const { patientId } = req.query;
    let selectedPatient = null;
    if (patientId) {
      selectedPatient = await PatientModel.findById(patientId).select('patientCode fullname');
    }

    res.render('doctor/create-record', {
      user: req.session.user,
      selectedPatientId: patientId,
      selectedPatient,
      errors: req.flash('errors') || [],
      oldData: req.flash('oldData')[0] || {},
      success: req.flash('success') || ''
    });
  } catch (error) {
    console.error(error);
    req.flash('errors', 'Không thể tải trang tạo bệnh án.');
    res.redirect('/doctor/patients');
  }
});

router.post('/medical-records/create', CreateRecordValidator, async (req, res) => {
    const flashAndRedirect = (errorMsg) => {
      req.flash('errors', errorMsg);
      req.flash('oldData', req.body);
      const patientIdQuery = req.body.patientId ? `?patientId=${req.body.patientId}` : '';
      return res.redirect(`/doctor/medical-records/create${patientIdQuery}`);
    };
    const result = validationResult(req);
    if (result.errors.length > 0) {
      return flashAndRedirect(result.errors[0].msg);
    }

    try {
      const {
        patientCode, reasonForVisit, diagnosis, notes, symptoms,
        height, weight, temperature, bloodPressure, pulse,
        followUpDate, followUpNote,
        'medication-name': medNames,
        'medication-dosage': medDosages,
        'medication-frequency': medFrequencies,
        'medication-duration': medDurations
      } = req.body;

      const patient = await PatientModel.findOne({ patientCode: patientCode });
      if (!patient) {
        return flashAndRedirect('Không tìm thấy bệnh nhân với mã đã nhập.');
      }

      const today = new Date();
      const datePrefix = `MR${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
      
      let recordCode = '';
      let attempts = 0;
      const MAX_ATTEMPTS = 5; 

      while (attempts < MAX_ATTEMPTS) {
        const lastRecordToday = await MedicalRecordModel.findOne({ recordCode: new RegExp(`^${datePrefix}`) }).sort({ recordCode: -1 });
        let newId = 1;
        if (lastRecordToday) {
          newId = parseInt(lastRecordToday.recordCode.split('-')[1], 10) + 1;
        }
        recordCode = `${datePrefix}-${newId.toString().padStart(5, '0')}`;
        const existingRecordWithCode = await MedicalRecordModel.findOne({ recordCode: recordCode });
        if (!existingRecordWithCode) break;
        attempts++;
      }

      const prescribedMedications = (medNames || []).map((name, index) => ({
        name,
        dosage: medDosages[index],
        frequency: medFrequencies[index],
        duration: medDurations[index],
      })).filter(med => med.name);

      const record = new MedicalRecordModel({
        recordCode,
        patientID: patient._id,
        doctorID: req.session.user.id,
        reasonForVisit,
        symptoms: symptoms ? symptoms.split(',').map(s => s.trim()) : [],
        diagnosis,
        notes,
        vitalSigns: { height, weight, temperature, bloodPressure, pulse },
        prescribedMedications,
        followUpDate: followUpDate || null,
        followUpNote,
      });
      await record.save();
      req.flash('success', 'Tạo bệnh án mới thành công!');
      res.redirect(`/doctor/patient/${patient._id}`);
    } catch (err) {
      if (err.code === 11000) {
        return flashAndRedirect('Mã bệnh án đã tồn tại. Vui lòng thử lại.');
      }
      console.error(err);
      return flashAndRedirect('Đã xảy ra lỗi khi lưu bệnh án, vui lòng thử lại.');
    }
  }
);
/*
|------------------------------------------------------------------------------------------------------
| THÔNG TIN TÀI KHOẢN
|------------------------------------------------------------------------------------------------------
*/

router.get('/profile', function (req, res, next) {
  try {
    res.render('doctor/profile', {
      user: req.session.user,
      success: req.flash('success') || '',
      errors: req.flash('errors') || '',
    });
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});

router.post('/profile', UpdateProfileValidator, async function (req, res, next) {
    const flashAndRedirect = (errorMsg) => {
      req.flash('errors', errorMsg);
      return res.redirect('/doctor/profile');
    };

    const result = validationResult(req);
    if (result.errors.length > 0) return flashAndRedirect(result.errors[0].msg);

  try {
    const { fullname, birthday, phone, address } = req.body;

    const updatedUser = await UserModel.findByIdAndUpdate(
      req.session.user.id,
      { fullname, birthday, phone, address },
      { new: true }
    );

    if (!updatedUser) {
      return flashAndRedirect('Không tìm thấy người dùng để cập nhật.');
    }

    req.session.user.fullname = updatedUser.fullname;
    req.session.user.birthday = updatedUser.birthday;
    req.session.user.phone = updatedUser.phone;
    req.session.user.address = updatedUser.address;

    req.flash('success', 'Cập nhật thông tin tài khoản thành công!');
    res.redirect('/doctor/profile');
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
    res.render('doctor/change-password', {
      user: req.session.user,
      errors: req.flash('errors') || '',
      success: req.flash('success') || '',
      oldData: req.flash('oldData')[0] || {},
    });
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});

router.post('/change-password', ChangePasswordValidator, async function (req, res, next) {
    const flashAndRedirect = (errorMsg) => {
      req.flash('errors', errorMsg);
      req.flash('oldData', req.body);
      return res.redirect('/doctor/change-password');
    };

    const result = validationResult(req);
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (result.errors.length !== 0) return flashAndRedirect(result.errors[0].msg);
    if (newPassword !== confirmPassword) return flashAndRedirect('Mật khẩu xác nhận không trùng khớp!');

  try {
    const user = await UserModel.findById(req.session.user.id);
    if (!user) {
      return flashAndRedirect('Lỗi trong quá trình xử lý, vui lòng thử lại!');
    }

    const matched = await argon2.verify(user.password, oldPassword);
    if (!matched) {
      return flashAndRedirect('Mật khẩu cũ không đúng!');
    }

    user.password = await argon2.hash(newPassword);
    await user.save();

    req.flash('success', "Cập nhật mật khẩu thành công!");
    res.redirect('/doctor/change-password');
  } catch (error) {
    return res.status(500).render('error', { error: { status: 500, stack: 'Unable to connect to the system, please try again!' }, message: 'Connection errors' });
  }
});

module.exports = router;