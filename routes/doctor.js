const express = require("express");
const { validationResult } = require("express-validator");
const argon2 = require("argon2");
const { requireWallet } = require("../middleware/permission");
const router = express.Router();
const moment = require("moment");
const { ethers } = require("ethers");
const {
  assignDoctor,
  checkRecordAccess,
  getAccessEvent,
} = require("../blockchain/services/blockchain-admin.js");

// Import Models
const UserModel = require("../models/user");
const DoctorModel = require("../models/doctor");
const PatientModel = require("../models/patient");
const MedicalRecordModel = require("../models/medical-record");
const MedicalRecordVersionModel = require("../models/medical-record-version");

// Import Validators
const ChangePasswordValidator = require("./validators/change-password");
const CreatePatientValidator = require("./validators/create-patient");
const CreateRecordValidator = require("./validators/create-record");
const UpdateProfileValidator = require("./validators/update-profile");

/*
|------------------------------------------------------------------------------------------------------
| TRANG TỔNG QUAN
|------------------------------------------------------------------------------------------------------
*/

router.get("/", async function (req, res, next) {
  try {
    var user = req.session.user;
    const doctor = await DoctorModel.findOne({ userID: user.id });
    return res.render("doctor/index", {
      title: "Trang tổng quan",
      user,
      doctor,
      errors: req.flash("errors"),
      success: req.flash("success"),
    });
  } catch (error) {
    return res.status(500).render("error", {
      title: "Lỗi",
      error: {
        status: 500,
        stack: "Không thể kết nối đến hệ thống, vui lòng thử lại!",
      },
      message: "Connection errors",
    });
  }
});

/*
|------------------------------------------------------------------------------------------------------
| HIỂN THỊ DANH SÁCH BỆNH NHÂN
|------------------------------------------------------------------------------------------------------
*/

router.get("/patients", async (req, res) => {
  const { keyword, gender, fromDate, toDate, page = 1, limit = 10 } = req.query;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1)
    return res.redirect("/doctor/patients");

  // Xây dựng truy vấn tìm kiếm
  const query = {};

  if (keyword) {
    query.$or = [
      { fullname: new RegExp(keyword, "i") },
      { email: new RegExp(keyword, "i") },
      { phone: new RegExp(keyword, "i") },
      { patientCode: new RegExp(keyword, "i") },
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

  res.render("doctor/patients", {
    title: "Danh sách bệnh nhân",
    user: req.session.user,
    success: req.flash("success"),
    errors: req.flash("errors"),
    patients,
    keyword,
    gender,
    fromDate,
    toDate,
    currentPage: pageNum,
    totalPages: totalPages,
    limit: limitNum,
  });
});

/*
|------------------------------------------------------------------------------------------------------
| TẠO HỒ SƠ BỆNH NHÂN
|------------------------------------------------------------------------------------------------------
*/

router.get("/patients/create", requireWallet, (req, res, next) => {
  try {
    res.render("doctor/create-patient", {
      title: "Tạo hồ sơ bệnh nhân",
      user: req.session.user,
      success: req.flash("success"),
      errors: req.flash("errors"),
      oldData: req.flash("oldData")[0] || {},
    });
  } catch (error) {
    return res.status(500).render("error", {
      title: "Lỗi",
      error: {
        status: 500,
        stack: "Không thể kết nối đến hệ thống, vui lòng thử lại!",
      },
      message: "Connection errors",
    });
  }
});

router.post(
  "/patients/create",
  requireWallet,
  CreatePatientValidator,
  async (req, res, next) => {
    const {
      fullname,
      email,
      birthday,
      gender,
      phone,
      address,
      identificationNumber,
      guardianName,
      guardianPhone,
      guardianIDNumber,
      bloodType,
      allergies,
      chronicDiseases,
    } = req.body;
    console.log(req.body);
    const result = validationResult(req);
    if (result.errors.length > 0) {
      req.flash("errors", result.errors[0].msg);
      req.flash("oldData", req.body);
      return res.redirect("/doctor/patients/create");
    }

    try {
      if (!identificationNumber && !guardianIDNumber) {
        req.flash(
          "errors",
          "Bệnh nhân phải có CMND/CCCD hoặc CCCD người giám hộ"
        );
        req.flash("oldData", req.body);
        return res.redirect("/doctor/patients/create");
      }

      // Kiểm tra trùng lặp thông tin bệnh nhân
      const query = [];
      if (email) query.push({ email });
      if (phone) query.push({ phone });
      if (identificationNumber) query.push({ identificationNumber });

      if (query.length > 0) {
        const existingPatient = await PatientModel.findOne({ $or: query });
        if (existingPatient) {
          let errorMessage = "Thông tin bệnh nhân đã tồn tại: ";
          if (existingPatient.email === email)
            errorMessage += `Email (${email}) đã được sử dụng.`;
          else if (existingPatient.phone === phone)
            errorMessage += `Số điện thoại (${phone}) đã được sử dụng.`;
          else if (
            existingPatient.identificationNumber === identificationNumber
          )
            errorMessage += `CMND/CCCD (${identificationNumber}) đã được sử dụng.`;

          req.flash("errors", errorMessage);
          req.flash("oldData", req.body);
          return res.redirect("/doctor/patients/create");
        }
      }

      let newPatientCode = "";
      let attempts = 0;
      const MAX_ATTEMPTS = 5; // Tránh vòng lặp vô hạn trong trường hợp trùng mã liên tục

      // Tạo mã bệnh nhân duy nhất, thử lại nếu bị trùng
      while (attempts < MAX_ATTEMPTS) {
        const lastPatient = await PatientModel.findOne().sort({
          patientCode: -1,
        });
        let nextCodeNumber;
        if (lastPatient && lastPatient.patientCode) {
          const lastCodeNumber = parseInt(
            lastPatient.patientCode.split("-")[1],
            10
          );
          nextCodeNumber = lastCodeNumber + 1;
        } else {
          nextCodeNumber = 1;
        }
        newPatientCode = "P-" + String(nextCodeNumber).padStart(8, "0");

        // Kiểm tra trùng mã
        const existingPatientWithCode = await PatientModel.findOne({
          patientCode: newPatientCode,
        });
        if (!existingPatientWithCode) break;
        attempts++;
      }

      const patient = new PatientModel({
        patientCode: newPatientCode,
        fullname,
        email,
        birthday,
        gender,
        phone,
        address,
        identificationNumber,
        guardianName,
        guardianPhone,
        guardianIDNumber,
        bloodType,
        allergies,
        chronicDiseases,
      });

      await patient.save();
      req.flash("success", `Tạo hồ sơ bệnh nhân ${newPatientCode} thành công!`);
      return res.redirect("/doctor/patients");
    } catch (err) {
      if (err.code === 11000) {
        // Lỗi trùng key trong MongoDB
        req.flash(
          "errors",
          "Mã bệnh nhân hoặc thông tin duy nhất (email/CMND) đã được sử dụng. Vui lòng thử lại."
        );
        req.flash("oldData", req.body);
        return res.redirect("/doctor/patients/create");
      }
      console.error(err);
      req.flash("errors", "Đã xảy ra lỗi khi tạo hồ sơ, vui lòng thử lại.");
      req.flash("oldData", req.body);
      return res.redirect("/doctor/patients/create");
    }
  }
);

/*
|------------------------------------------------------------------------------------------------------
| XEM CHI TIẾT HỒ SƠ BỆNH NHÂN
|------------------------------------------------------------------------------------------------------
*/

router.get("/patient/:id", async (req, res) => {
  try {
    const patient = await PatientModel.findById(req.params.id);
    if (!patient) {
      req.flash("errors", "Không tìm thấy bệnh nhân.");
      return res.redirect("/doctor/patients");
    }

    const doctor = await DoctorModel.findOne({
      userID: req.session.user.id,
    }).lean();

    const accessibleRecordCodes =
      doctor?.accessibleRecords
        ?.filter((r) => r.patientCode === patient.patientCode)
        .map((r) => r.recordCode) || [];

    const medicalRecords = await MedicalRecordModel.find({
      patientID: req.params.id,
      recordCode: { $in: accessibleRecordCodes },
    })
      .populate("doctorID", "fullname")
      .sort({ visitDate: -1 });

    res.render("doctor/patient-detail", {
      title: `Chi tiết bệnh nhân - ${patient.fullname}`,
      user: req.session.user,
      patient,
      medicalRecords,
      success: req.flash("success"),
      errors: req.flash("errors"),
    });
  } catch (error) {
    console.error(error);
    req.flash("errors", "Có lỗi xảy ra khi truy vấn thông tin bệnh nhân.");
    res.redirect("/doctor/patients");
  }
});

/*
|------------------------------------------------------------------------------------------------------
| XEM CHI TIẾT BỆNH ÁN
|------------------------------------------------------------------------------------------------------
*/

router.get("/medical-record/:id", async (req, res) => {
  try {
    const doctor = await DoctorModel.findOne({ userID: req.session.user.id });
    if (!doctor) {
      req.flash("errors", "Không tìm thấy thông tin bác sĩ.");
      return res.redirect("/doctor/patients");
    }

    const record = await MedicalRecordModel.findById(req.params.id)
      .populate("patientID", "patientCode fullname")
      .populate("doctorID", "fullname");

    if (!record) {
      req.flash("errors", "Không tìm thấy bệnh án.");
      return res.redirect("/doctor/patients");
    }

    // Kiểm tra trạng thái xác nhận của bệnh án
    if (record.status !== "Verified") {
      req.flash(
        "errors",
        "Bệnh án này chưa được xác nhận trên blockchain. Vui lòng xác nhận trước khi xem chi tiết."
      );

      // Nếu chưa có lastVerifiedHash thì là tạo mới
      if (!record.lastVerifiedHash) {
        return res.redirect(
          `/doctor/medical-records/confirm/${record._id}?type=create`
        );
      }

      return res.redirect(
        `/doctor/medical-records/confirm/${record._id}?type=edit`
      );
    }

    // Kiểm tra xem bệnh án đã được xác nhận trên blockchain chưa
    const hasAccessOnChain = await checkRecordAccess(
      record.patientID.patientCode,
      record.recordCode,
      doctor.doctorCode
    );

    await getAccessEvent(
      record.patientID.patientCode,
      record.recordCode,
      doctor.doctorCode
    );

    if (!hasAccessOnChain) {
      req.flash("errors", "Bạn không có quyền truy cập vào bệnh án này.");
      return res.redirect("doctor/patients");
    }

    res.render("doctor/record-detail", {
      title: `Bệnh án ${record.recordCode}`,
      user: req.session.user,
      record,
      success: req.flash("success"),
      errors: req.flash("errors"),
    });
  } catch (error) {
    console.error(error);
    req.flash("errors", "Có lỗi xảy ra khi truy vấn thông tin bệnh án.");
    res.redirect("doctor/patients");
  }
});

/*
|------------------------------------------------------------------------------------------------------
| HIỂN THỊ DANH SÁCH BỆNH ÁN
|------------------------------------------------------------------------------------------------------
*/

router.get("/records", async (req, res) => {
  try {
    const { filterDate, page = 1, limit = 10 } = req.query; // Lấy tham số lọc ngày, trang và giới hạn từ query
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1)
      return res.redirect("/doctor/records");

    const query = {};
    let currentDateDisplay = "Tất cả";

    if (filterDate && moment(filterDate, "YYYY-MM-DD", true).isValid()) {
      const startOfDay = moment(filterDate).startOf("day").toDate();
      const endOfDay = moment(filterDate).endOf("day").toDate();
      query.visitDate = { $gte: startOfDay, $lte: endOfDay };
      currentDateDisplay = moment(filterDate).format("DD/MM/YYYY");
    }

    const totalRecords = await MedicalRecordModel.countDocuments(query);
    const records = await MedicalRecordModel.find(query)
      .populate("patientID", "fullname patientCode")
      .populate("doctorID", "fullname")
      .sort({ visitDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.ceil(totalRecords / limitNum);

    res.render("doctor/records", {
      title: "Danh sách bệnh án",
      user: req.session.user,
      records: records,
      currentDate: currentDateDisplay,
      filterDate: filterDate,
      currentPage: pageNum,
      totalPages: totalPages,
      limit: limitNum,
      errors: req.flash("errors"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error(error);
    req.flash("errors", "Không thể tải danh sách bệnh án.");
    res.redirect("/doctor");
  }
});

/*
|------------------------------------------------------------------------------------------------------
| TẠO BỆNH ÁN MỚI
|------------------------------------------------------------------------------------------------------
*/

router.get("/medical-records/create", requireWallet, async (req, res) => {
  try {
    const { patientId } = req.query;
    let selectedPatient = null;
    if (patientId) {
      selectedPatient = await PatientModel.findById(patientId).select(
        "patientCode fullname"
      );
    }

    res.render("doctor/create-record", {
      title: "Tạo bệnh án",
      user: req.session.user,
      selectedPatientId: patientId,
      selectedPatient,
      errors: req.flash("errors"),
      oldData: req.flash("oldData")[0] || {},
      success: req.flash("success"),
    });
  } catch (error) {
    console.error(error);
    req.flash("errors", "Không thể tải trang tạo bệnh án.");
    res.redirect("/doctor/patients");
  }
});

router.post(
  "/medical-records/create",
  requireWallet,
  CreateRecordValidator,
  async (req, res) => {
    const result = validationResult(req);
    if (result.errors.length > 0) {
      req.flash("errors", result.errors[0].msg);
      req.flash("oldData", req.body);
      const patientIdQuery = req.body.patientId
        ? `?patientId=${req.body.patientId}`
        : "";
      return res.redirect(`/doctor/medical-records/create${patientIdQuery}`);
    }

    try {
      const {
        patientCode,
        reasonForVisit,
        diagnosis,
        notes,
        symptoms,
        height,
        weight,
        temperature,
        bloodPressure,
        pulse,
        followUpDate,
        followUpNote,
        "medication-name[]": medNames,
        "medication-dosage[]": medDosages,
        "medication-frequency[]": medFrequencies,
        "medication-duration[]": medDurations,
      } = req.body;

      const patient = await PatientModel.findOne({ patientCode: patientCode });
      if (!patient) {
        req.flash("errors", "Không tìm thấy bệnh nhân với mã đã nhập.");
        req.flash("oldData", req.body);
        const patientIdQuery = req.body.patientId
          ? `?patientId=${req.body.patientId}`
          : "";
        return res.redirect(`/doctor/medical-records/create${patientIdQuery}`);
      }

      const today = new Date();
      const datePrefix = `MR${today.getFullYear()}${(today.getMonth() + 1)
        .toString()
        .padStart(2, "0")}${today.getDate().toString().padStart(2, "0")}`;

      let recordCode = "";
      let attempts = 0;
      const MAX_ATTEMPTS = 5;

      while (attempts < MAX_ATTEMPTS) {
        const lastRecordToday = await MedicalRecordModel.findOne({
          recordCode: new RegExp(`^${datePrefix}`),
        }).sort({ recordCode: -1 });
        let newId = 1;
        if (lastRecordToday) {
          newId = parseInt(lastRecordToday.recordCode.split("-")[1], 10) + 1;
        }
        recordCode = `${datePrefix}-${newId.toString().padStart(5, "0")}`;
        const existingRecordWithCode = await MedicalRecordModel.findOne({
          recordCode: recordCode,
        });
        if (!existingRecordWithCode) break;
        attempts++;
      }

      let prescribedMedications = [];
      if (medNames) {
        const names = Array.isArray(medNames) ? medNames : [medNames];
        const dosages = Array.isArray(medDosages) ? medDosages : [medDosages];
        const frequencies = Array.isArray(medFrequencies)
          ? medFrequencies
          : [medFrequencies];
        const durations = Array.isArray(medDurations)
          ? medDurations
          : [medDurations];

        prescribedMedications = names
          .map((name, index) => ({
            name,
            dosage: dosages[index],
            frequency: frequencies[index],
            duration: durations[index],
          }))
          .filter((med) => med.name && med.name.trim() !== "");
      }

      const dbStart = Date.now();
      const bcStart = dbStart;

      const recordData = {
        recordCode,
        patientID: patient._id,
        doctorID: req.session.user.id,
        reasonForVisit,
        symptoms: symptoms
          ? symptoms
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        diagnosis,
        notes,
        vitalSigns: { height, weight, temperature, bloodPressure, pulse },
        prescribedMedications,
        followUpDate: followUpDate || null,
        followUpNote,
        created_at: new Date(dbStart),
      };

      const recordHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(recordData))
      );

      // Lưu vào DB với status Pending
      const record = new MedicalRecordModel({
        ...recordData,
        status: "Pending", // Đợi xác nhận từ blockchain
        recordHash: recordHash,
      });

      // Cập nhật danh sách bệnh án có thể truy cập của bác sĩ
      const updatedDoctor = await DoctorModel.findOneAndUpdate(
        { userID: req.session.user.id },
        {
          $addToSet: {
            accessibleRecords: {
              recordCode: recordData.recordCode,
              patientCode: patientCode,
            },
          },
        }
      );

      await record.save();

      // Lưu phiên bản đầu tiên vào lịch sử (Version 1)
      await MedicalRecordVersionModel.create({
        medicalRecordID: record._id,
        recordCode: record.recordCode,
        version: 1,
        recordData: {
          reasonForVisit: record.reasonForVisit,
          symptoms: record.symptoms,
          diagnosis: record.diagnosis,
          notes: record.notes,
          vitalSigns: record.vitalSigns,
          prescribedMedications: record.prescribedMedications,
          followUpDate: record.followUpDate,
          followUpNote: record.followUpNote,
        },
        recordHash: recordHash,
        updatedBy: req.session.user.id,
      });

      const dbEnd = Date.now();
      const dbDuration = dbEnd - dbStart;

      // console.log(`dbStart: ${dbStart}`);
      // console.log(`dbEnd: ${dbEnd}`);
      // console.log(`dbDuration: ${dbDuration} ms`);

      return res.redirect(
        `/doctor/medical-records/confirm/${record._id}?type=create`
      );
    } catch (err) {
      console.error("Blockchain or DB save error:", err);
      if (err.code === 11000) {
        req.flash("errors", "Mã bệnh án đã tồn tại. Vui lòng thử lại.");
        req.flash("oldData", req.body);
        const patientIdQuery = req.body.patientId
          ? `?patientId=${req.body.patientId}`
          : "";
        return res.redirect(`/doctor/medical-records/create${patientIdQuery}`);
      }
      console.error(err);
      req.flash("errors", "Đã xảy ra lỗi khi lưu bệnh án, vui lòng thử lại.");
      req.flash("oldData", req.body);
      const patientIdQuery = req.body.patientId
        ? `?patientId=${req.body.patientId}`
        : "";
      return res.redirect(`/doctor/medical-records/create${patientIdQuery}`);
    }
  }
);

/*
|------------------------------------------------------------------------------------------------------
| CHỈNH SỬA BỆNH ÁN
|------------------------------------------------------------------------------------------------------
*/

router.get("/medical-records/edit/:id", async (req, res) => {
  try {
    const record = await MedicalRecordModel.findById(req.params.id)
      .populate("patientID", "patientCode fullname")
      .populate("doctorID", "fullname");

    if (!record) {
      req.flash("errors", "Không tìm thấy bệnh án.");
      return res.redirect("/doctor/records");
    }

    const doctor = await DoctorModel.findOne({ userID: req.session.user.id });
    if (!doctor) {
      req.flash("errors", "Không tìm thấy thông tin bác sĩ.");
      return res.redirect("/doctor/records");
    }

    const hasAccessOnChain = await checkRecordAccess(
      record.patientID.patientCode,
      record.recordCode,
      doctor.doctorCode
    );

    if (!hasAccessOnChain) {
      req.flash("errors", "Bạn không có quyền truy cập vào bệnh án này.");
      return res.redirect("doctor/records");
    }

    res.render("doctor/edit-record", {
      title: `Chỉnh sửa bệnh án ${record.recordCode}`,
      user: req.session.user,
      record,
      errors: req.flash("errors"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error(error);
    req.flash("errors", "Không thể tải trang chỉnh sửa bệnh án.");
    res.redirect("/doctor/records");
  }
});

router.post(
  "/medical-records/edit/:id",
  requireWallet,
  CreateRecordValidator,
  async (req, res) => {
    const result = validationResult(req);
    if (result.errors.length > 0) {
      req.flash("errors", result.errors[0].msg);
      const recordIdQuery = req.params.id ? `?id=${req.params.id}` : "";
      return res.redirect(`/doctor/medical-records/edit/${recordIdQuery}`);
    }
    try {
      const {
        recordCode,
        patientCode,
        reasonForVisit,
        diagnosis,
        notes,
        symptoms,
        height,
        weight,
        temperature,
        bloodPressure,
        pulse,
        followUpDate,
        followUpNote,
        "medication-name[]": medNames,
        "medication-dosage[]": medDosages,
        "medication-frequency[]": medFrequencies,
        "medication-duration[]": medDurations,
      } = req.body;
      const record = await MedicalRecordModel.findById(req.params.id);
      if (!record) {
        req.flash("errors", "Không tìm thấy bệnh án.");
        return res.redirect("/doctor/records");
      }

      const patient = await PatientModel.findOne({ patientCode: patientCode });
      if (!patient) {
        req.flash("errors", "Không tìm thấy bệnh nhân với mã đã nhập.");
        req.flash("oldData", req.body);
        return res.redirect("/doctor/records");
      }

      const prescribedMedications = (record.prescribedMedications || []).map(
        (m) => ({
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration,
        })
      );

      const updatedRecordData = {
        recordCode,
        patientID: patient._id,
        doctorID: record.doctorID,
        reasonForVisit,
        symptoms: symptoms
          ? symptoms
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        diagnosis,
        notes,
        vitalSigns: { height, weight, temperature, bloodPressure, pulse },
        prescribedMedications,
        followUpDate: followUpDate || null,
        followUpNote,
        updated_at: new Date(),
      };

      const recordHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(updatedRecordData))
      );

      const updatedRecord = await MedicalRecordModel.findByIdAndUpdate(
        req.params.id,
        {
          ...updatedRecordData,
          status: "Pending", // Đợi xác nhận từ blockchain
          recordHash: recordHash,
          lastVerifiedHash: record.recordHash, // Lưu hash cũ
          updatedBy: req.session.user.id,
          $inc: { currentVersion: 1 }, // Tăng số phiên bản
        },
        { new: true }
      );

      await updatedRecord.save();

      // Lưu phiên bản mới vào lịch sử
      await MedicalRecordVersionModel.create({
        medicalRecordID: updatedRecord._id,
        recordCode: updatedRecord.recordCode,
        version: updatedRecord.currentVersion,
        recordData: {
          reasonForVisit: updatedRecord.reasonForVisit,
          symptoms: updatedRecord.symptoms,
          diagnosis: updatedRecord.diagnosis,
          notes: updatedRecord.notes,
          vitalSigns: updatedRecord.vitalSigns,
          prescribedMedications: updatedRecord.prescribedMedications,
          followUpDate: updatedRecord.followUpDate,
          followUpNote: updatedRecord.followUpNote,
        },
        recordHash: recordHash,
        updatedBy: req.session.user.id,
      });

      return res.redirect(
        `/doctor/medical-records/confirm/${updatedRecord._id}?type=edit`
      );
    } catch (err) {
      console.error("Blockchain or DB save error:", err);
      req.flash("errors", "Đã xảy ra lỗi khi lưu bệnh án, vui lòng thử lại.");
      req.flash("oldData", req.body);
      const recordIdQuery = req.params.id ? `?id=${req.params.id}` : "";
      return res.redirect(`/doctor/medical-records/edit/${recordIdQuery}`);
    }
  }
);

/*
|------------------------------------------------------------------------------------------------------
| HIỂN THỊ TRANG XÁC NHẬN GHI BLOCKCHAIN
|------------------------------------------------------------------------------------------------------
*/
router.get("/medical-records/confirm/:id", requireWallet, async (req, res) => {
  try {
    const { type } = req.query; // 'create', 'edit'
    const record = await MedicalRecordModel.findById(req.params.id);

    if (!record) {
      req.flash("errors", "Không tìm thấy bệnh án để xác nhận.");
      return res.redirect("/doctor/records");
    }

    const patient = await PatientModel.findById(record.patientID);

    req.flash(
      "success",
      `Bệnh án đã được ${
        type === "create" ? "tạo" : "cập nhật"
      } thành công! Vui lòng xác nhận để ghi lên blockchain.`
    );

    res.render("doctor/confirm-record", {
      title: "Xác nhận Bệnh án",
      user: req.session.user,
      record: record,
      patient: patient,
      type: type || "create",
      success: req.flash("success"),
      errors: req.flash("errors"),
    });
  } catch (error) {
    console.error("Lỗi khi hiển thị trang xác nhận:", error);
    req.flash("errors", "Có lỗi xảy ra khi hiển thị trang xác nhận.");
    res.redirect("/doctor/records");
  }
});

/*
|------------------------------------------------------------------------------------------------------
| CẬP NHẬT TRẠNG THÁI BỆNH ÁN SAU KHI GHI LÊN BLOCKCHAIN
|------------------------------------------------------------------------------------------------------
*/
router.post("/medical-records/update-status", async (req, res) => {
  try {
    const { recordId } = req.body;

    if (!recordId) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thông tin cần thiết." });
    }

    const record = await MedicalRecordModel.findByIdAndUpdate(
      recordId,
      { status: "Verified" },
      { new: true }
    );

    if (!record) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bệnh án." });
    }

    if (!record.lastVerifiedHash) {
      const bcStart = new Date(record.created_at).getTime();
      const bcEnd = Date.now();
      const bcDuration = bcEnd - bcStart;
      // console.log(`bcStart: ${bcStart}`);
      // console.log(`bcEnd: ${bcEnd}`);
      // console.log(`bcDuration: ${bcDuration} ms`);
    }

    return res.json({
      success: true,
      message: "Cập nhật trạng thái bệnh án thành công.",
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái bệnh án:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi cập nhật trạng thái bệnh án.",
    });
  }
});

/*
|------------------------------------------------------------------------------------------------------
| THÔNG TIN TÀI KHOẢN
|------------------------------------------------------------------------------------------------------
*/

router.get("/profile", function (req, res, next) {
  try {
    res.render("doctor/profile", {
      title: "Thông tin tài khoản",
      user: req.session.user,
      success: req.flash("success"),
      errors: req.flash("errors"),
    });
  } catch (error) {
    return res.status(500).render("error", {
      title: "Lỗi",
      error: {
        status: 500,
        stack: "Không thể kết nối đến hệ thống, vui lòng thử lại!",
      },
      message: "Connection errors",
    });
  }
});

router.post("/profile/connect-wallet", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res
        .status(400)
        .json({ success: false, message: "Địa chỉ ví không được cung cấp." });
    }

    if (
      walletAddress.toLowerCase() === process.env.WALLET_ADDRESS.toLowerCase()
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Địa chỉ ví không hợp lệ." });
    }

    if (req.session.user.walletAddress) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản đã được liên kết với một ví.",
      });
    }

    const existingWalletUser = await UserModel.findOne({
      walletAddress: walletAddress,
    });
    if (existingWalletUser) {
      return res.status(409).json({
        success: false,
        message: "Địa chỉ ví đã được liên kết với tài khoản khác.",
      });
    }

    const doctor = await DoctorModel.findOne({ userID: req.session.user.id });
    const updatedUser = await UserModel.findByIdAndUpdate(
      req.session.user.id,
      { walletAddress: walletAddress },
      { new: true }
    );

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng." });
    }

    await assignDoctor(doctor.doctorCode, walletAddress);

    req.session.user.walletAddress = updatedUser.walletAddress;
    return res.json({
      success: true,
      walletAddress: updatedUser.walletAddress,
    });
  } catch (error) {
    console.error("Lỗi khi kết nối ví:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
});

router.post(
  "/profile",
  UpdateProfileValidator,
  async function (req, res, next) {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        req.flash("errors", result.array()[0].msg);
        return res.redirect("/doctor/profile");
      }

      const { fullname, birthday, phone, address } = req.body;

      const updatedUser = await UserModel.findByIdAndUpdate(
        req.session.user.id,
        { fullname, birthday, phone, address },
        { new: true }
      );

      if (!updatedUser) {
        req.flash("errors", "Không tìm thấy người dùng để cập nhật.");
        return res.redirect("/doctor/profile");
      }

      req.session.user.fullname = updatedUser.fullname;
      req.session.user.birthday = updatedUser.birthday;
      req.session.user.phone = updatedUser.phone;
      req.session.user.address = updatedUser.address;

      req.flash("success", "Cập nhật thông tin tài khoản thành công!");
      return res.redirect("/doctor/profile");
    } catch (error) {
      console.error(error);
      return res.status(500).render("error", {
        title: "Lỗi",
        error: {
          status: 500,
          stack: "Không thể kết nối đến hệ thống, vui lòng thử lại!",
        },
        message: "Connection errors",
      });
    }
  }
);

/*
|------------------------------------------------------------------------------------------------------
| ĐỔI MẬT KHẨU
|------------------------------------------------------------------------------------------------------
*/
router.get("/change-password", function (req, res, next) {
  try {
    res.render("doctor/change-password", {
      title: "Đổi mật khẩu",
      user: req.session.user,
      errors: req.flash("errors"),
      success: req.flash("success"),
      oldData: req.flash("oldData")[0] || {},
    });
  } catch (error) {
    return res.status(500).render("error", {
      title: "Lỗi",
      error: {
        status: 500,
        stack: "Không thể kết nối đến hệ thống, vui lòng thử lại!",
      },
      message: "Connection errors",
    });
  }
});

router.post(
  "/change-password",
  ChangePasswordValidator,
  async function (req, res, next) {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        req.flash("errors", result.array()[0].msg);
        req.flash("oldData", req.body);
        return res.redirect("/doctor/change-password");
      }

      const { oldPassword, newPassword, confirmPassword } = req.body;
      if (newPassword !== confirmPassword) {
        req.flash("errors", "Mật khẩu xác nhận không trùng khớp!");
        req.flash("oldData", req.body);
        return res.redirect("/doctor/change-password");
      }

      const user = await UserModel.findById(req.session.user.id);
      if (!user) {
        req.flash("errors", "Lỗi trong quá trình xử lý, vui lòng thử lại!");
        return res.redirect("/doctor/change-password");
      }

      const matched = await argon2.verify(user.password, oldPassword);
      if (!matched) {
        req.flash("errors", "Mật khẩu cũ không đúng!");
        req.flash("oldData", req.body);
        return res.redirect("/doctor/change-password");
      }

      user.password = await argon2.hash(newPassword);
      await user.save();

      req.flash("success", "Cập nhật mật khẩu thành công!");
      return res.redirect("/doctor/change-password");
    } catch (error) {
      return res.status(500).render("error", {
        title: "Lỗi",
        error: {
          status: 500,
          stack: "Không thể kết nối đến hệ thống, vui lòng thử lại!",
        },
        message: "Connection errors",
      });
    }
  }
);

module.exports = router;
