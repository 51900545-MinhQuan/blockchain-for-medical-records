const { check, validationResult } = require('express-validator');

module.exports = [
  check('oldPassword')
    .exists().withMessage('Chưa có mật khẩu cũ, mật khẩu cũ cần được gửi với key là oldPassword')
    .notEmpty().withMessage('Vui lòng nhập mật khẩu cũ'),
  check('newPassword')
    .exists().withMessage('Chưa có mật khẩu mới, mật khẩu mới cần được gửi với key là newPassword')
    .notEmpty().withMessage('Vui lòng nhập mật khẩu mới')
    .isLength({ min: 8, max: 15 }).withMessage('Mật khẩu phải từ 8 đến 15 ký tự')
    .matches(/^(?=.*?[0-9])(?=.*?[a-z])(?=.*?[A-Z])(?=.*\W)(?!.* ).{8,15}$/).withMessage('Mật khẩu phải có tối thiểu 8 ký tự và tối đa 15 ký tự, ít nhất một chữ hoa, một chữ thường, một chữ số, một ký tự đặc biệt và không chứa khoảng trắng'),
  check('confirmPassword')
    .exists().withMessage('Chưa có xác nhận mật khẩu, xác nhận mật khẩu cần được gửi với key là confirmPassword')
    .notEmpty().withMessage('Vui lòng nhập xác nhận mật khẩu'),
]