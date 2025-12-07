const express = require("express");
const router = express.Router();

// Import Model
const AdminLogModel = require("../models/admin-logs.js");
const moment = require("moment");
/*
|------------------------------------------------------------------------------------------------------
| TRANG TỔNG QUAN
|------------------------------------------------------------------------------------------------------
*/

router.get("/", async (req, res, next) => {
  try {
    var user = req.session.user;
    return res.render("admin/index", {
      code: 0,
      title: "Trang tổng quan",
      message: "Ok",
      user,
      errors: req.flash("errors"),
      success: req.flash("success"),
    });
  } catch (error) {
    return res.status(500).render("error", {
      title: "Lỗi",
      error: {
        status: 500,
        stack: "Unable to connect to the system, please try again!",
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
    console.error("Error fetching admin logs:", error);
    return res.status(500).render("error", {
      title: "Lỗi",
      error: {
        status: 500,
        stack: "Unable to connect to the system, please try again!",
      },
      message: "Connection errors",
    });
  }
});

module.exports = router;
