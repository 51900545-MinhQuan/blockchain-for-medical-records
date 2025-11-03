const { body } = require("express-validator");

module.exports = [
  body("email")
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage("Email không hợp lệ."),
  body("phone")
    .optional({ checkFalsy: true })
    .isMobilePhone("vi-VN")
    .withMessage("Số điện thoại không hợp lệ."),
  body("address")
    .optional({ checkFalsy: true })
    .isLength({ min: 5 })
    .withMessage("Địa chỉ phải có ít nhất 5 ký tự."),
  body("guardianPhone")
    .optional({ checkFalsy: true })
    .isMobilePhone("vi-VN")
    .withMessage("Số điện thoại người giám hộ không hợp lệ."),
  body("guardianIDNumber")
    .optional({ checkFalsy: true })
    .isLength({ min: 9, max: 12 })
    .withMessage("CMND/CCCD người giám hộ phải có từ 9 đến 12 chữ số."),
];
