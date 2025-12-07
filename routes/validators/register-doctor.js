const { check } = require("express-validator");

module.exports = [
  check("specialization")
    .exists()
    .withMessage(
      "Chưa có chuyên khoa, chuyên khoa cần được gửi với key là specialization"
    )
    .notEmpty()
    .withMessage("Vui lòng nhập chuyên khoa"),
  check("licenseNumber")
    .exists()
    .withMessage(
      "Chưa có số giấy phép, số giấy phép cần được gửi với key là licenseNumber"
    )
    .notEmpty()
    .withMessage("Vui lòng nhập số giấy phép")
    .matches(/^TEST-DOCTOR-\d{7}$/)
    .withMessage(
      "Số giấy phép không hợp lệ. Định dạng yêu cầu: TEST-DOCTOR-<7 chữ số>"
    ),
];
