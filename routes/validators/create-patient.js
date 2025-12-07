const { check } = require("express-validator");

const CreatePatientValidator = [
  check("fullname")
    .exists()
    .withMessage("Họ và tên là trường bắt buộc.")
    .notEmpty()
    .withMessage("Vui lòng nhập họ tên."),

  check("email")
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage("Địa chỉ Email không hợp lệ."),

  check("birthday")
    .exists()
    .withMessage("Ngày sinh là trường bắt buộc.")
    .notEmpty()
    .withMessage("Vui lòng nhập ngày sinh.")
    .isISO8601()
    .withMessage("Ngày sinh không hợp lệ (định dạng yyyy-mm-dd).")
    .custom((value) => {
      const birthday = new Date(value);
      const now = new Date();
      const minDate = new Date();
      minDate.setFullYear(now.getFullYear() - 150);

      if (birthday > now) {
        throw new Error("Ngày sinh không thể sau ngày hiện tại.");
      }
      if (birthday < minDate) {
        throw new Error("Ngày sinh không hợp lệ.");
      }

      return true;
    }),

  check("gender")
    .exists()
    .withMessage("Giới tính là trường bắt buộc.")
    .notEmpty()
    .withMessage("Vui lòng chọn giới tính."),

  check("phone")
    .optional({ checkFalsy: true })
    .isLength({ min: 10, max: 11 })
    .withMessage("Số điện thoại phải từ 10 đến 11 chữ số."),

  check("identificationNumber")
    .optional({ checkFalsy: true })
    .isNumeric()
    .withMessage("CMND/CCCD phải là số.")
    .custom((value) => {
      if (value.length !== 9 && value.length !== 12) {
        throw new Error("CMND/CCCD phải có 9 hoặc 12 chữ số.");
      }
      return true;
    }),

  check("guardianPhone")
    .optional({ checkFalsy: true })
    .isMobilePhone("vi-VN")
    .withMessage("Số điện thoại người giám hộ không hợp lệ."),

  check("guardianIDNumber")
    .optional({ checkFalsy: true })
    .isNumeric()
    .withMessage("CMND/CCCD người giám hộ phải là số.")
    .custom((value) => {
      if (value.length !== 9 && value.length !== 12) {
        throw new Error("CMND/CCCD người giám hộ phải có 9 hoặc 12 chữ số.");
      }
      return true;
    }),

  // Other optional text fields with no specific format validation
  check("address").optional({ checkFalsy: true }),
  check("guardianName").optional({ checkFalsy: true }),
  check("bloodType").optional({ checkFalsy: true }),
  check("allergies").optional({ checkFalsy: true }),
  check("chronicDiseases").optional({ checkFalsy: true }),
];

module.exports = CreatePatientValidator;
