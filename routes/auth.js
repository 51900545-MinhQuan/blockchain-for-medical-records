const express = require("express");
const argon2 = require("argon2");
const { check, validationResult } = require("express-validator");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const router = express.Router();

// Import Model
const UserModel = require("../models/user");
const PatientModel = require("../models/patient");

// Import Middleware
const Auth = require("../middleware/auth");

// Import Validators
const RegisterValidator = require("./validators/register");
const LoginValidator = require("./validators/login");
const ResetPasswordValidator = require("./validators/reset-password");

/*
|------------------------------------------------------------------------------------------------------
| ĐĂNG NHẬP TÀI KHOẢN NGƯỜI DÙNG
|------------------------------------------------------------------------------------------------------
*/
router.get("/login", Auth.checkLogin, async (req, res, next) => {
  try {
    res.render("auth/login", {
      errors: req.flash("errors"),
      email: req.flash("email"),
    });
  } catch (error) {
    return res.status(500).render("error", {
      error: {
        status: 500,
        stack: "Unable to connect to the system, please try again!",
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
    };

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
        stack: "Unable to connect to the system, please try again!",
      },
      message: "Connection errors",
    });
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
      errors: req.flash("errors"),
      success: req.flash("success"),
      oldData: req.flash("oldData")[0] || {},
    });
  } catch (error) {
    return res.status(500).render("error", {
      error: {
        status: 500,
        stack: "Unable to connect to the system, please try again!",
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
      role,
      identificationNumber,
    } = req.body;

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

    const hashed = await argon2.hash(password);
    // Nếu role là 2 (bác sĩ) thì gán role = 2, không thì (bệnh nhân) gán role = 1
    const userRole = role === "2" ? 2 : 1;
    const newUser = await UserModel.create({
      fullname,
      email,
      birthday,
      phone,
      address,
      identificationNumber,
      password: hashed,
      role: userRole,
    });

    req.flash("success", "Đăng ký tài khoản thành công!");
    return res.redirect("/auth/login");
  } catch (error) {
    return res.status(500).render("error", {
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
| Đặt lại mật khẩu (tạm thời bỏ qua chức năng này)
|------------------------------------------------------------------------------------------------------
*/
router.get("/reset-password", (req, res, next) => {
  try {
    res.render("auth/reset-password", {
      errors: req.flash("errors"),
      email: req.flash("email"),
    });
  } catch (error) {
    return res.status(500).render("error", {
      error: {
        status: 500,
        stack: "Unable to connect to the system, please try again!",
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

module.exports = router;
