const express = require("express");
const { check, validationResult } = require("express-validator");
const argon2 = require("argon2");
const {
  assignPatient,
  linkGuardianToPatient,
} = require("../blockchain/services/blockchain-admin.js");

const router = express.Router();

// Import Model
const UserModel = require("../models/user");
const PatientModel = require("../models/patient");
const MedicalRecordModel = require("../models/medical-record");
const DoctorModel = require("../models/doctor");

// Import Validators
const ChangePasswordValidator = require("./validators/change-password");
const UpdateProfileValidator = require("./validators/update-profile");
const UpdatePatientProfileValidator = require("./validators/update-patient-profile"); // New validator

/*
|------------------------------------------------------------------------------------------------------
| TRANG TỔNG QUAN
|------------------------------------------------------------------------------------------------------
*/

router.get("/", function (req, res, next) {
  try {
    if (req.session.user.role === 0) {
      return res.redirect("/admin");
    }
    if (req.session.user.role === 2) {
      return res.redirect("/doctor");
    }

    res.render("user/index", {
      title: "Trang chủ",
      user: req.session.user,
      errors: req.flash("error") || "",
      success: req.flash("success") || "",
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
| XEM HỒ SƠ BỆNH ÁN (CHO BỆNH NHÂN)
|------------------------------------------------------------------------------------------------------
*/

router.get("/medical-history", async (req, res) => {
  try {
    const allPatients = await PatientModel.find({
      $or: [
        { linkedUserID: req.session.user.id },
        { patientCode: { $in: req.session.user.linkedPatientCode || [] } },
      ],
    }).sort({ fullname: 1 });

    if (!allPatients || allPatients.length === 0) {
      return res.render("user/patient-detail", {
        title: "Lịch sử khám bệnh",
        user: req.session.user,
        patient: null,
        allPatients: [],
        medicalRecords: [],
        currentPage: 1,
        totalPages: 0,
        success: req.flash("success") || "",
        errors:
          req.flash("error") ||
          "Không tìm thấy hồ sơ bệnh nhân nào được liên kết. Hãy thử tìm và liên kết.",
      });
    }

    const selectedPatientCode = req.query.patientCode;
    let selectedPatient = allPatients.find(
      (p) => p.patientCode === selectedPatientCode
    );
    if (!selectedPatient) {
      if (selectedPatientCode) {
        req.flash("error", "Bạn không có quyền truy cập hồ sơ bệnh nhân này.");
        return res.redirect(
          `/medical-history?patientCode=${allPatients[0].patientCode}`
        );
      }
      selectedPatient = allPatients[0];
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { patientID: selectedPatient._id };

    const totalRecords = await MedicalRecordModel.countDocuments(query);
    const medicalRecords = await MedicalRecordModel.find({
      patientID: selectedPatient._id,
    })
      .populate("doctorID", "fullname")
      .sort({ visitDate: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalRecords / limit);

    res.render("user/patient-detail", {
      title: "Lịch sử khám bệnh",
      user: req.session.user,
      patient: selectedPatient,
      allPatients: allPatients,
      medicalRecords,
      currentPage: page,
      totalPages,
      success: req.flash("success") || "",
      errors: req.flash("error") || "",
    });
  } catch (error) {
    console.error(error);
    req.flash("error", "Có lỗi xảy ra khi truy vấn thông tin bệnh nhân.");
    res.redirect("/");
  }
});

router.get("/medical-record/:id", async (req, res) => {
  try {
    const record = await MedicalRecordModel.findById(req.params.id)
      .populate("patientID")
      .populate("doctorID", "fullname linkedDoctorCode");

    if (!record) {
      req.flash("error", "Không tìm thấy bệnh án.");
      return res.redirect("/medical-history");
    }

    const isThePatient =
      record.patientID.linkedUserID &&
      record.patientID.linkedUserID.toString() === req.session.user.id;
    const isGuardian =
      req.session.user.linkedPatientCode?.includes(
        record.patientID.patientCode
      ) ?? false;

    if (!isThePatient && !isGuardian) {
      req.flash("error", "Bạn không có quyền xem bệnh án này.");
      return res.redirect("/medical-history");
    }

    const doctors = await DoctorModel.find({})
      .populate("userID", "fullname")
      .select("doctorCode userID");

    // Tìm các bác sĩ đã được cấp quyền truy cập vào bệnh án này
    const grantedAccessDoctors = await DoctorModel.find({
      "accessibleRecords.recordCode": record.recordCode,
    }).populate("userID", "fullname");

    var disableGrantAccess = false;
    if (
      (record.patientID.guardianIDNumber &&
        !record.patientID.usingGuardianWallet) ||
      (isThePatient && !record.patientID.linkedUserID.walletAddress)
    ) {
      disableGrantAccess = true;
    }

    res.render("user/record-detail", {
      title: `Chi tiết bệnh án ${record.recordCode}`,
      user: req.session.user,
      record,
      doctors,
      grantedAccessDoctors,
      disableGrantAccess: disableGrantAccess,
      success: req.flash("success") || "",
      errors: req.flash("error") || "",
    });
  } catch (error) {
    console.error(error);
    req.flash("error", "Có lỗi xảy ra khi truy vấn thông tin bệnh án.");
    res.redirect("/medical-history");
  }
});

/*
|------------------------------------------------------------------------------------------------------
| LIÊN KẾT BỆNH NHÂN
|------------------------------------------------------------------------------------------------------
*/
router.post("/profile/link-patients", async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Vui lòng đăng nhập." });
    }

    const currentUser = await UserModel.findById(user.id);
    if (!currentUser) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng." });
    }

    const matchingPatients = await PatientModel.find({
      $and: [
        { linkedUserID: null }, // Chỉ tìm những bệnh nhân chưa được liên kết
        {
          $or: [
            { identificationNumber: currentUser.identificationNumber },
            { guardianIDNumber: currentUser.identificationNumber },
            { phone: currentUser.phone },
            { guardianPhone: currentUser.phone },
          ],
        },
      ],
    });

    if (matchingPatients.length === 0) {
      return res.json({
        success: true,
        message: "Không tìm thấy hồ sơ bệnh nhân mới để liên kết.",
        found: 0,
      });
    }

    const patientCodes = matchingPatients.map((p) => p.patientCode);

    // Liên kết bệnh nhân với user
    await PatientModel.updateMany(
      { _id: { $in: matchingPatients.map((p) => p._id) } },
      { $set: { linkedUserID: currentUser._id } }
    );

    // Cập nhật user với các mã bệnh nhân mới
    currentUser.linkedPatientCode.push(...patientCodes);
    await currentUser.save();

    return res.json({
      success: true,
      message: `Đã liên kết thành công ${matchingPatients.length} hồ sơ bệnh nhân. Trang sẽ được tải lại.`,
      found: matchingPatients.length,
    });
  } catch (error) {
    console.error("Lỗi khi liên kết bệnh nhân thủ công:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
});

/*
|------------------------------------------------------------------------------------------------------
| LIÊN KẾT VÍ NGƯỜI GIÁM HỘ VỚI BỆNH NHÂN
|------------------------------------------------------------------------------------------------------
*/
router.post("/profile/link-guardian-wallet", async (req, res) => {
  try {
    const { patientCode } = req.body;
    const user = req.session.user;

    if (!patientCode) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu mã bệnh nhân." });
    }

    if (!user || !user.walletAddress) {
      return res.status(401).json({
        success: false,
        message: "Người giám hộ phải kết nối ví trước.",
      });
    }

    const patient = await PatientModel.findOne({ patientCode });
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bệnh nhân." });
    }

    await linkGuardianToPatient(patientCode, user.walletAddress);

    patient.usingGuardianWallet = true;
    await patient.save();

    return res.json({
      success: true,
      message: `Đã liên kết ví của bạn với hồ sơ bệnh nhân ${patientCode} trên blockchain.`,
    });
  } catch (error) {
    console.error("Lỗi khi liên kết ví người giám hộ:", error);
    const errorMessage =
      error.shortMessage ||
      "Lỗi máy chủ khi thực hiện liên kết trên blockchain.";
    return res.status(500).json({ success: false, message: errorMessage });
  }
});

/*
|------------------------------------------------------------------------------------------------------
| CẤP QUYỀN TRUY CẬP BỆNH ÁN
|------------------------------------------------------------------------------------------------------
*/

router.post("/medical-record/grant-access", async (req, res) => {
  try {
    const { doctorCode, recordCode, patientCode, recordId } = req.body;

    if (!doctorCode || !recordCode || !patientCode || !recordId) {
      return res.status(400).json({
        success: false,
        message: "Thông tin không hợp lệ để cấp quyền.",
      });
    }

    const updatedDoctor = await DoctorModel.findOneAndUpdate(
      { doctorCode: doctorCode },
      {
        $addToSet: {
          accessibleRecords: {
            recordCode: recordCode,
            patientCode: patientCode,
          },
        },
      }
    );

    if (!updatedDoctor) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bác sĩ để cấp quyền.",
      });
    }

    return res.json({
      success: true,
      message: `Cấp quyền xem bệnh án cho bác sĩ ${doctorCode} thành công.`,
    });
  } catch (error) {
    console.error("Lỗi khi cấp quyền truy cập:", error);
    return res.status(500).json({
      success: false,
      message: "Có lỗi xảy ra trong quá trình cấp quyền.",
    });
  }
});

/*
|------------------------------------------------------------------------------------------------------
| THU HỒI QUYỀN TRUY CẬP BỆNH ÁN
|------------------------------------------------------------------------------------------------------
*/

router.post("/medical-record/revoke-access", async (req, res) => {
  try {
    const { doctorCode, recordCode, patientCode, recordId } = req.body;

    if (!doctorCode || !recordCode || !patientCode || !recordId) {
      return res.status(400).json({
        success: false,
        message: "Thông tin không hợp lệ để thu hồi quyền.",
      });
    }

    const updatedDoctor = await DoctorModel.findOneAndUpdate(
      { doctorCode: doctorCode },
      {
        $pull: {
          accessibleRecords: {
            recordCode: recordCode,
            patientCode: patientCode,
          },
        },
      },
      { new: true }
    );

    if (!updatedDoctor) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bác sĩ để thu hồi quyền.",
      });
    }

    return res.json({
      success: true,
      message: `Thu hồi quyền xem bệnh án từ bác sĩ ${doctorCode} thành công.`,
    });
  } catch (error) {
    console.error("Lỗi khi thu hồi quyền truy cập:", error);
    return res.status(500).json({
      success: false,
      message: "Có lỗi xảy ra trong quá trình thu hồi quyền.",
    });
  }
});

/*
|------------------------------------------------------------------------------------------------------
| THÔNG TIN TÀI KHOẢN
|------------------------------------------------------------------------------------------------------
*/

router.get("/profile", async function (req, res, next) {
  try {
    const hasLinkedPatient = await PatientModel.exists({
      linkedUserID: req.session.user.id,
    });

    res.render("user/profile", {
      title: "Thông tin tài khoản",
      user: req.session.user,
      hasLinkedPatient: hasLinkedPatient,
      success: req.flash("success") || "",
      errors: req.flash("error") || "",
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

router.post(
  "/profile",
  UpdateProfileValidator,
  async function (req, res, next) {
    try {
      const result = validationResult(req);
      if (result.errors.length > 0) {
        req.flash("error", result.errors[0].msg);
        return res.redirect("/profile");
      }

      const { fullname, birthday, phone, address } = req.body;

      const updatedUser = await UserModel.findByIdAndUpdate(
        req.session.user.id,
        { fullname, birthday, phone, address },
        { new: true }
      );

      if (!updatedUser) {
        req.flash("error", "Không tìm thấy người dùng để cập nhật.");
        return res.redirect("/profile");
      }

      req.session.user.fullname = updatedUser.fullname;
      req.session.user.birthday = updatedUser.birthday;
      req.session.user.phone = updatedUser.phone;
      req.session.user.address = updatedUser.address;

      req.flash("success", "Cập nhật thông tin tài khoản thành công!");
      res.redirect("/profile");
    } catch (error) {
      console.error(error);
      return res.status(500).render("error", {
        title: "Lỗi",
        error: {
          status: 500,
          stack: "Unable to connect to the system, please try again!",
        },
        message: "Connection errors",
      });
    }
  }
);

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
    console.log(existingWalletUser);
    if (existingWalletUser) {
      return res.status(409).json({
        success: false,
        message: "Địa chỉ ví đã được liên kết với tài khoản khác.",
      });
    }

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

    const linkedPatient = await PatientModel.findOne({
      linkedUserID: updatedUser._id,
    });
    if (linkedPatient) {
      try {
        await assignPatient(linkedPatient.patientCode, walletAddress);
      } catch (chainError) {
        console.error(
          `Failed to assign patient ${linkedPatient.patientCode} on-chain:`,
          chainError.message
        );
      }
    }

    req.session.user.walletAddress = updatedUser.walletAddress;
    return res.json({
      success: true,
      walletAddress: updatedUser.walletAddress,
    });
  } catch (error) {
    console.error("Lỗi khi kết nối ví:", error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: "Lỗi máy chủ." });
    }
  }
});

/*
|------------------------------------------------------------------------------------------------------
| ĐỔI MẬT KHẨU
|------------------------------------------------------------------------------------------------------
*/
router.get("/change-password", function (req, res, next) {
  try {
    res.render("user/change-password", {
      title: "Đổi mật khẩu",
      user: req.session.user,
      errors: req.flash("errors") || [],
      success: req.flash("success") || [],
      oldPassword: req.flash("oldPassword") || "",
      newPassword: req.flash("newPassword") || "",
      confirmPassword: req.flash("confirmPassword") || "",
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

router.post(
  "/change-password",
  ChangePasswordValidator,
  async function (req, res, next) {
    try {
      const result = validationResult(req);
      const { oldPassword, newPassword, confirmPassword } = req.body;

      if (result.errors.length !== 0) {
        req.flash("errors", result.errors[0].msg);
        return res.redirect("/change-password");
      }

      if (newPassword !== confirmPassword) {
        req.flash("errors", "Mật khẩu xác nhận không trùng khớp!");
        return res.redirect("/change-password");
      }

      const user = await UserModel.findById(req.session.user.id);
      if (!user) {
        req.flash("errors", "Lỗi trong quá trình xữ lý, vui lòng thử lại!");
        return res.redirect("/change-password");
      }

      const matched = await argon2.verify(user.password, oldPassword);

      if (!matched) {
        req.flash("errors", "Mật khẩu cũ không đúng!");
        return res.redirect("/change-password");
      }
      user.password = await argon2.hash(newPassword);
      await user.save();

      req.flash("success", "Cập nhật mật khẩu thành công!");
      res.redirect("/change-password");
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
  }
);

module.exports = router;
