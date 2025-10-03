const { check, validationResult } = require('express-validator');

module.exports = [
  check('fullname')
    .exists().withMessage('Chưa có tên người dùng, tên người dùng cần được gửi với key là fullname')
    .notEmpty().withMessage('Vui lòng nhập họ tên người dùng'),
  check('email')
    .exists().withMessage('Chưa có địa chỉ Email, Email cần được gửi với key là email')
    .notEmpty().withMessage('Vui lòng nhập địa chỉ Email')
    .isEmail().withMessage('Địa chỉ Email không hợp lệ'),
  check('email').custom(value => {
    if (value.toLowerCase().includes('admin')) {
      throw new Error('Địa chỉ Email không được chứa từ Admin');
    }
    return true;
  }),
  check('password')
    .exists().withMessage('Chưa có mật khẩu, mật khẩu mới cần được gửi với key là newPassword')
    .notEmpty().withMessage('Vui lòng nhập mật khẩu')
    .isLength({ min: 8, max: 15 }).withMessage('Mật khẩu phải từ 8 đến 15 ký tự')
    .matches(/^(?=.*?[0-9])(?=.*?[a-z])(?=.*?[A-Z])(?=.*\W)(?!.* ).{8,15}$/).withMessage('Mật khẩu phải có tối thiểu 8 ký tự và tối đa 15 ký tự, ít nhất một chữ hoa, một chữ thường, một chữ số, một ký tự đặc biệt và không chứa khoảng trắng'),
  check('confirmPassword')
    .exists().withMessage('Chưa có xác nhận mật khẩu, xác nhận mật khẩu cần được gửi với key là confirmPassword')
    .notEmpty().withMessage('Vui lòng nhập xác nhận mật khẩu'),
  check('birthday')
    .exists().withMessage('Chưa có ngày sinh, ngày sinh cần được gửi với key là birthday')
    .notEmpty().withMessage('Vui lòng nhập ngày sinh'),
  check('phone')
    .exists().withMessage('Chưa có số điện thoại, số điện thoại cần được gửi với key là phone')
    .notEmpty().withMessage('Vui lòng nhập số điện thoại')
    .isLength({ min: 10 }).withMessage('Số điện thoại phải tối thiểu 10 chữ số')
    .isLength({ max: 11 }).withMessage('Số điện thoại phải tối đa 11 chữ số'),
  check('address')
    .exists().withMessage('Chưa có địa chỉ hiện tại, địa chỉ hiện tại cần được gửi với key là address')
    .notEmpty().withMessage('Vui lòng nhập địa chỉ hiện tại'),
]