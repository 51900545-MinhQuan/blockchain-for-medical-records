const { check } = require("express-validator");

const CreateRecordValidator = [
  check("patientCode").notEmpty().withMessage("Vui lòng nhập mã bệnh nhân"),
  check("reasonForVisit").notEmpty().withMessage("Vui lòng nhập lý do khám"),
  check("diagnosis").notEmpty().withMessage("Vui lòng nhập chẩn đoán"),

  // Optional fields validation
  check("height")
    .optional({ checkFalsy: true })
    .isNumeric()
    .withMessage("Chiều cao phải là một con số"),
  check("weight")
    .optional({ checkFalsy: true })
    .isNumeric()
    .withMessage("Cân nặng phải là một con số"),
  check("temperature")
    .optional({ checkFalsy: true })
    .isNumeric()
    .withMessage("Nhiệt độ phải là một con số"),
  check("pulse")
    .optional({ checkFalsy: true })
    .isNumeric()
    .withMessage("Nhịp tim phải là một con số"),
  check("followUpDate")
    .optional({ checkFalsy: true })
    .isISO8601()
    .toDate()
    .withMessage("Ngày tái khám không hợp lệ"),
];

module.exports = CreateRecordValidator;
