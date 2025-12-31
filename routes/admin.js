const express = require("express");
const router = express.Router();
const { ethers } = require("ethers");

// Import Model
const AdminLogModel = require("../models/admin-logs.js");
const MedicalRecordModel = require("../models/medical-record");
const UserModel = require("../models/user");
const DoctorModel = require("../models/doctor");
const PatientModel = require("../models/patient");
const moment = require("moment");
const {
  verifyRecordIntegrity,
} = require("../blockchain/services/blockchain-admin.js");
const { getRecordHash } = require("../blockchain/services/blockchain-admin.js");

/*
|------------------------------------------------------------------------------------------------------
| TRANG TỔNG QUAN
|------------------------------------------------------------------------------------------------------
*/

router.get("/", async (req, res, next) => {
  try {
    var user = req.session.user;

    const totalPatients = await PatientModel.countDocuments();
    const totalDoctors = await DoctorModel.countDocuments();
    const totalRecords = await MedicalRecordModel.countDocuments();
    const totalLogs = await AdminLogModel.countDocuments();

    const recentLogs = await AdminLogModel.find()
      .sort({ created_at: -1 })
      .limit(5);

    return res.render("admin/index", {
      title: "Trang tổng quan",
      user,
      stats: { totalPatients, totalDoctors, totalRecords, totalLogs },
      recentLogs,
      moment,
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
| TRANG LOGS BLOCKCHAIN
|------------------------------------------------------------------------------------------------------
*/

router.get("/logs", async (req, res) => {
  try {
    const { type } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const filter = {};
    const validTypes = [
      "RecordAdded",
      "RecordUpdated",
      "AccessGranted",
      "AccessRevoked",
    ];

    if (type && validTypes.includes(type)) {
      filter.event = type;
    }

    const totalLogs = await AdminLogModel.countDocuments(filter);
    const totalPages = Math.ceil(totalLogs / limit);

    const logs = await AdminLogModel.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    logs.forEach((log) => {
      if (log.data.doctor && typeof log.data.doctor === "object") {
        const doctorInfo = log.data.doctor;
        if (doctorInfo.code && doctorInfo.fullname) {
          log.data.doctor = `${doctorInfo.code} - ${doctorInfo.fullname}`;
        } else if (doctorInfo.code) {
          log.data.doctor = doctorInfo.code;
        } else if (doctorInfo.address) {
          log.data.doctor = doctorInfo.address;
        }
      }
    });
    res.render("admin/admin-logs", {
      title: "Blockchain Logs",
      user: req.session.user,
      logs,
      currentType: type || "all",
      currentPage: page,
      totalPages,
      type,
      moment,
      errors: req.flash("errors"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error("Lỗi khi lấy logs admin:", error);
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
| TRANG QUẢN LÝ HỒ SƠ Y TẾ
|------------------------------------------------------------------------------------------------------
*/

router.get("/records", async (req, res) => {
  try {
    const { filterDate, page = 1 } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;
    const query = { status: "Verified" };

    let currentDate = "Tất cả";
    if (filterDate && moment(filterDate, "YYYY-MM-DD", true).isValid()) {
      const startOfDay = moment(filterDate).startOf("day").toDate();
      const endOfDay = moment(filterDate).endOf("day").toDate();
      query.visitDate = { $gte: startOfDay, $lte: endOfDay };
      currentDate = moment(filterDate).format("DD/MM/YYYY");
    }

    const totalRecords = await MedicalRecordModel.countDocuments(query);
    const records = await MedicalRecordModel.find(query)
      .populate("patientID", "fullname patientCode")
      .populate("doctorID", "fullname")
      .sort({ visitDate: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalRecords / limit);

    return res.render("admin/records", {
      title: "Quản lý hồ sơ y tế",
      user: req.session.user,
      records,
      currentDate,
      filterDate,
      currentPage: parseInt(page),
      totalPages,
      errors: req.flash("errors"),
      success: req.flash("success"),
    });
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
});

router.get("/medical-records/:id", async (req, res) => {
  try {
    const record = await MedicalRecordModel.findById(req.params.id)
      .populate("patientID", "fullname patientCode")
      .populate("doctorID", "fullname linkedDoctorCode");

    if (!record) {
      req.flash("errors", "Không tìm thấy bệnh án.");
      return res.redirect("/admin/records");
    }

    if (record.status !== "Verified") {
      req.flash("errors", "Bệnh án chưa được xác nhận.");
      return res.redirect("/admin/records");
    }

    const logs = await AdminLogModel.find({
      "data.recordCode": record.recordCode,
      event: { $in: ["RecordAdded", "RecordUpdated"] },
    }).sort({ created_at: -1 });

    return res.render("admin/record-detail", {
      title: "Chi tiết bệnh án",
      user: req.session.user,
      record,
      logs,
      moment,
      errors: req.flash("errors"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error(error);
    req.flash("errors", "Lỗi khi tải thông tin bệnh án.");
    return res.redirect("/admin/records");
  }
});

router.post("/medical-records/verify-integrity", async (req, res) => {
  try {
    const { recordId } = req.body;
    const record = await MedicalRecordModel.findById(recordId).lean();
    if (!record) {
      return res.json({ success: false, message: "Không tìm thấy bệnh án." });
    }

    // Tái tạo object dữ liệu để tính hash
    const vs = record.vitalSigns || {};
    const vitalSigns = {
      height: vs.height == null ? "" : String(vs.height),
      weight: vs.weight == null ? "" : String(vs.weight),
      temperature: vs.temperature == null ? "" : String(vs.temperature),
      bloodPressure: vs.bloodPressure || "",
      pulse: vs.pulse == null ? "" : String(vs.pulse),
    };

    const prescribedMedications = (record.prescribedMedications || []).map(
      (m) => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
      })
    );

    const recordData = {
      recordCode: record.recordCode,
      patientID: record.patientID,
      doctorID: record.doctorID,
      reasonForVisit: record.reasonForVisit,
      symptoms: record.symptoms,
      diagnosis: record.diagnosis,
      notes: record.notes,
      vitalSigns: vitalSigns,
      prescribedMedications: prescribedMedications,
      followUpDate: record.followUpDate || null,
      followUpNote: record.followUpNote,
    };

    if (record.lastVerifiedHash) {
      recordData.updated_at = record.updated_at;
    } else {
      recordData.created_at = record.created_at;
    }

    const recordHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(recordData))
    );

    const onchainHash = await getRecordHash(record.recordCode);

    console.log("Hash được tính:", recordHash);
    console.log("Hash được lưu trên blockchain:", onchainHash);

    const isValid = await verifyRecordIntegrity(record.recordCode, recordHash);

    return res.json({
      success: true,
      isValid,
      localHash: recordHash,
      blockchainHash: onchainHash,
    });
  } catch (error) {
    console.error("Lỗi xác thực dữ liệu bệnh án:", error);
    return res.json({
      success: false,
      message: "Lỗi server: " + error.message,
    });
  }
});

/*
|------------------------------------------------------------------------------------------------------
| XÓA TOÀN BỘ DATABASE (CHỈ DÙNG CHO MỤC ĐÍCH TEST)
|------------------------------------------------------------------------------------------------------
*/
const mongoose = require("mongoose");

router.get("/delete-all-collections", async (req, res) => {
  try {
    res.render("admin/delete-all-collections", {
      layout: false,
      title: "Xóa toàn bộ collections",
      user: req.session.user,
      errors: req.flash("errors"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error("Lỗi khi tải trang xóa collections:", error);
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

router.post("/delete-all-collections", async (req, res) => {
  try {
    const collections = await mongoose.connection.db.collections();
    const collectionsToDrop = [];

    for (const collection of collections) {
      if (
        !collection.collectionName.startsWith("system.") &&
        collection.collectionName !== "sessions"
      ) {
        collectionsToDrop.push(collection.drop());
      }
    }

    await Promise.all(collectionsToDrop);

    res.json({
      success: true,
      message: "Xóa toàn bộ collections thành công.",
    });
  } catch (error) {
    console.error("Lỗi khi xóa collections:", error);
    res
      .status(500)
      .json({ success: false, message: "Xóa collections thất bại." });
  }
});

module.exports = router;
