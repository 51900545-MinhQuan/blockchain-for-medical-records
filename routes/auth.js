const express = require("express");
const argon2 = require("argon2");
const { check, validationResult } = require("express-validator");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const mongoose = require("mongoose");

const router = express.Router();

// Import Model
const UserModel = require("../models/user");
const PatientModel = require("../models/patient");
const DoctorModel = require("../models/doctor");

// Import Middleware
const Auth = require("../middleware/auth");

// Import Validators
const RegisterValidator = require("./validators/register");
const LoginValidator = require("./validators/login");
const ResetPasswordValidator = require("./validators/reset-password");
const { link } = require("fs");

/*
|------------------------------------------------------------------------------------------------------
| ĐĂNG NHẬP TÀI KHOẢN NGƯỜI DÙNG
|------------------------------------------------------------------------------------------------------
*/
router.get("/login", Auth.checkLogin, async (req, res, next) => {
  try {
    res.render("auth/login", {
      title: "Đăng nhập",
      errors: req.flash("errors"),
      email: req.flash("email"),
    });
  } catch (error) {
    return res.status(500).render("error", {
      error: {
        title: "Lỗi",
        status: 500,
        stack: "Không thể kết nối đến hệ thống, vui lòng thử lại!",
      },
      message: "Connection errors",
    });
  }
});

router.post("/login", LoginValidator, async (req, res, next) => {
  try {
    const result = validationResult(req);
    const { email, password } = req.body;

    if (result.errors.length !== 0) {
      req.flash("errors", result.errors[0].msg);
      req.flash("email", email);
      return res.redirect("/auth/login");
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      req.flash("errors", "Email hoặc mật khẩu không tồn tại!");
      req.flash("email", email);
      return res.redirect("/auth/login");
    }

    var matched = await argon2.verify(user.password, password);
    if (!matched) {
      req.flash("errors", "Email hoặc mật khẩu không tồn tại!");
      req.flash("email", email);
      return res.redirect("/auth/login");
    }

    req.session.user = {
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      birthday: user.birthday,
      phone: user.phone,
      address: user.address,
      identificationNumber: user.identificationNumber,
      role: user.role,
      linkedDoctorCode: user.linkedDoctorCode,
      linkedPatientCode: user.linkedPatientCode,
      walletAddress: user.walletAddress,
    };

    // uncomment khi cần liên kết mã bác sĩ bị thiếu
    // if (user.role === 2 && !user.linkedDoctorCode) {
    //   const doctorProfile = await DoctorModel.findOne({ userID: user._id });
    //   if (doctorProfile && doctorProfile.doctorCode) {
    //     await UserModel.updateOne(
    //       { _id: user._id },
    //       { linkedDoctorCode: doctorProfile.doctorCode }
    //     );
    //   }
    // }

    if (req.session.user.role == 0) {
      return res.redirect("/admin");
    }
    if (req.session.user.role == 2) {
      return res.redirect("/doctor");
    }

    return res.redirect("/");
  } catch (error) {
    return res.status(500).render("error", {
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
| KIỂM TRA VÀ LẤY ĐỊA CHỈ VÍ CỦA NGƯỜI DÙNG
|------------------------------------------------------------------------------------------------------
*/
router.post("/get-wallet-address", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required." });
    }
    const user = await UserModel.findOne({ email: email });
    res.json({
      success: true,
      walletAddress: user ? user.walletAddress : null,
    });
  } catch (error) {
    console.error("Lỗi khi lấy địa chỉ ví:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

/*
|------------------------------------------------------------------------------------------------------
| ĐĂNG KÝ TÀI KHOẢN NGƯỜI DÙNG
|------------------------------------------------------------------------------------------------------
*/
router.get("/register", Auth.checkLogin, async (req, res, next) => {
  try {
    res.render("auth/register", {
      title: "Đăng ký",
      errors: req.flash("errors"),
      success: req.flash("success"),
      oldData: req.flash("oldData")[0] || {},
    });
  } catch (error) {
    return res.status(500).render("error", {
      error: {
        title: "Lỗi",
        status: 500,
        stack: "Không thể kết nối đến hệ thống, vui lòng thử lại!",
      },
      message: "Connection errors",
    });
  }
});

router.post("/register", RegisterValidator, async (req, res, next) => {
  try {
    const result = validationResult(req);
    const {
      fullname,
      email,
      password,
      confirmPassword,
      birthday,
      phone,
      address,
      identificationNumber,
    } = req.body;
    const role = req.body.role ? parseInt(req.body.role, 10) : 1;

    if (result.errors.length !== 0) {
      req.flash("errors", result.errors[0].msg);
      req.flash("oldData", req.body);
      return res.redirect("/auth/register");
    }

    const existingUser = await UserModel.findOne({
      $or: [{ email }, { identificationNumber: identificationNumber || null }],
    });

    if (existingUser) {
      let errorMsg;
      if (existingUser.email === email) {
        errorMsg = "Địa chỉ Email đã tồn tại";
      } else if (
        identificationNumber &&
        existingUser.identificationNumber === identificationNumber
      ) {
        errorMsg = "CMND/CCCD đã tồn tại!";
      }
      req.flash("errors", errorMsg);
      req.flash("oldData", req.body);
      return res.redirect("/auth/register");
    }

    if (password !== confirmPassword) {
      req.flash("errors", "Mật khẩu không trùng khớp");
      req.flash("oldData", req.body);
      return res.redirect("/auth/register");
    }
    const newUser = new UserModel({
      fullname,
      email,
      birthday,
      phone,
      address,
      identificationNumber,
      password: await argon2.hash(password),
      role,
    });
    await newUser.save();

    // Nếu là bac sĩ, chuyển đến trang đăng ký thông tin bác sĩ
    if (role === 2) {
      req.session.pendingDoctorRegistration = newUser._id;
      return res.redirect("/auth/register-doctor");
    } else {
      req.flash("success", "Đăng ký tài khoản thành công!");
      return res.redirect("/auth/login");
    }
  } catch (error) {
    return res.status(500).render("error", {
      error: {
        title: "Lỗi",
        status: 500,
        stack: "Không thể kết nối đến hệ thống, vui lòng thử lại!",
      },
      message: "Connection errors",
    });
  }
});

/*
|------------------------------------------------------------------------------------------------------
| ĐĂNG KÝ THÔNG TIN BÁC SĨ
|------------------------------------------------------------------------------------------------------
*/
router.get("/register-doctor", (req, res) => {
  if (!req.session.pendingDoctorRegistration) {
    return res.redirect("/auth/register");
  }
  res.render("auth/register-doctor", {
    title: "Xác thực thông tin bác sĩ",
    errors: req.flash("errors"),
    oldData: req.flash("oldData")[0] || {},
  });
});

router.post("/register-doctor", async (req, res) => {
  const userID = req.session.pendingDoctorRegistration;
  if (!userID) {
    return res.redirect("/auth/register");
  }

  const { specialization, licenseNumber } = req.body;

  try {
    if (!specialization || !licenseNumber) {
      req.flash("errors", "Vui lòng điền đầy đủ thông tin.");
      req.flash("oldData", req.body);
      return res.redirect("/auth/register-doctor");
    }

    const existingDoctor = await DoctorModel.findOne({ licenseNumber });
    if (existingDoctor) {
      req.flash("errors", "Số giấy phép hành nghề đã tồn tại.");
      req.flash("oldData", req.body);
      return res.redirect("/auth/register-doctor");
    }

    // Tao mã bác sĩ định dạng DOC-0000000X
    let newDoctorCode = "";
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    while (attempts < MAX_ATTEMPTS) {
      const lastDoctor = await DoctorModel.findOne().sort({ doctorCode: -1 });
      let nextCodeNumber = 1;
      if (lastDoctor && lastDoctor.doctorCode) {
        const lastCodeNumber = parseInt(
          lastDoctor.doctorCode.split("-")[1],
          10
        );
        nextCodeNumber = lastCodeNumber + 1;
      }
      newDoctorCode = "DOC-" + String(nextCodeNumber).padStart(8, "0");

      const existingDoctorWithCode = await DoctorModel.findOne({
        doctorCode: newDoctorCode,
      });
      if (!existingDoctorWithCode) break;
      attempts++;
    }

    await DoctorModel.create({
      doctorCode: newDoctorCode,
      userID,
      specialization,
      licenseNumber,
    });

    const updatedUser = await UserModel.findByIdAndUpdate(userID, {
      linkedDoctorCode: newDoctorCode,
    });

    // Xóa session tạm thời
    delete req.session.pendingDoctorRegistration;
    req.flash("success", "Đăng ký tài khoản bác sĩ thành công!");
    return res.redirect("/auth/login");
  } catch (error) {
    console.error("Doctor registration error:", error);
    req.flash("errors", "Đã có lỗi xảy ra, vui lòng thử lại.");
    req.flash("oldData", req.body);
    // Nếu có lỗi xảy ra, xóa user đã tạo
    await UserModel.findByIdAndDelete(userID);
    return res.redirect("/auth/register");
  }
});

/*
|------------------------------------------------------------------------------------------------------
| Đặt lại mật khẩu (tạm thời bỏ qua chức năng này)
|------------------------------------------------------------------------------------------------------
*/
router.get("/reset-password", (req, res, next) => {
  try {
    res.render("auth/reset-password", {
      title: "Đặt lại mật khẩu",
      errors: req.flash("errors"),
      email: req.flash("email"),
    });
  } catch (error) {
    return res.status(500).render("error", {
      error: {
        title: "Lỗi",
        status: 500,
        stack: "Không thể kết nối đến hệ thống, vui lòng thử lại!",
      },
      message: "Connection errors",
    });
  }
});

router.post(
  "/reset-password",
  ResetPasswordValidator,
  async (req, res, next) => {
    try {
      const result = validationResult(req);
      const { email } = req.body;

      req.flash("email", email);

      if (result.errors.length !== 0) {
        result = result.mapped();
        for (fields in result) {
          req.flash("errors", result[fields].msg);
          return res.redirect("/auth/reset-password");
        }
      }

      const user = await UserModel.findOne({ email });

      if (!user) {
        req.flash("error", "Đỉa chỉ email không tồn tại!");
        return res.redirect("/auth/reset-password");
      }

      let password = crypto.randomBytes(8).toString("base64").slice(0, 10);
      password = password.replace(/[^a-zA-Z0-9]/g, "") + "A1!";
      const hashed = await argon2.hash(password);

      const updatedUser = await UserModel.findByIdAndUpdate(user.id, {
        password: hashed,
      });
      if (!updatedUser) {
        req.flash(
          "errors",
          "Lỗi trong quá trình xử lý, không tìm thấy người dùng để cập nhật!"
        );
        return res.redirect("/auth/reset-password");
      }

      var transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });

      transporter.sendMail({
        from: process.env.mailUser,
        to: `${email}`,
        subject: "[TB] THÔNG TIN TÀI KHOẢN NGƯỜI DÙNG - BỆNH VIỆN XXXXXX",
        html: `<p>Vui lòng không chia sẻ thông tin này đến bất kỳ ai. 
      Đây là thông tin tài khoản của bạn sau khi đặt lại mật khẩu:</p>
      <b>Tên người dùng: </b>${user.fullname} <br> 
      <b>Địa chỉ email: </b>${user.email} <br> 
      <b>Mật khẩu mới: </b>${password} 
      <p>Trân trọng ./.</p>`,
      });

      req.flash("success", 1);
      return res.redirect("/auth/email");
    } catch (error) {
      return res.status(500).render("error", {
        error: { status: 500, stack: "Tạm thời bỏ qua chức năng này" },
        title: "Lỗi",
        message: "Connection errors",
      });
    }
  }
);

/*
|------------------------------------------------------------------------------------------------------
| ĐĂNG XUẤT TÀI KHOẢN NGƯỜI DÙNG
|------------------------------------------------------------------------------------------------------
*/
router.get("/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
      return next(err);
    }
    res.redirect("/auth/login");
  });
});

/*
|------------------------------------------------------------------------------------------------------
| XÓA TOÀN BỘ DATABASE (CHỈ DÙNG CHO MỤC ĐÍCH TEST)
|------------------------------------------------------------------------------------------------------
*/
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
      message: "All collections deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting collections:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete collections." });
  }
});

module.exports = router;
