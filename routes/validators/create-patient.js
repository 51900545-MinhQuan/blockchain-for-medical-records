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

  check("phone")
    .exists()
    .withMessage("Số điện thoại là trường bắt buộc.")
    .notEmpty()
    .withMessage("Vui lòng nhập số điện thoại.")
    .isLength({ min: 10, max: 11 })
    .withMessage("Số điện thoại phải có từ 10 đến 11 chữ số."),

  check("gender")
    .exists()
    .withMessage("Giới tính là trường bắt buộc.")
    .notEmpty()
    .withMessage("Vui lòng chọn giới tính."),

  // Optional fields
  check("address").optional(),
  check("identificationNumber").optional(),
  check("guardianName").optional(),
  check("guardianPhone").optional(),
  check("guardianIDNumber").optional(),
  check("bloodType").optional(),
  check("allergies").optional(),
  check("chronicDiseases").optional(),
];

module.exports = CreatePatientValidator;
