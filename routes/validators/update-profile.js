const { check } = require('express-validator');

module.exports = [
  check('fullname')
    .exists().withMessage('Chưa có tên người dùng, tên người dùng cần được gửi với key là fullname')
    .notEmpty().withMessage('Vui lòng nhập họ tên người dùng'),
  check('birthday')
    .exists().withMessage('Chưa có ngày sinh, ngày sinh cần được gửi với key là birthday')
    .notEmpty().withMessage('Vui lòng nhập ngày sinh'),
  check('phone')
    .exists().withMessage('Chưa có số điện thoại, số điện thoại cần được gửi với key là phone')
    .notEmpty().withMessage('Vui lòng nhập số điện thoại')
    .isLength({ min: 10, max: 11 }).withMessage('Số điện thoại phải có độ dài từ 10 đến 11 chữ số'),
  check('address')
    .exists().withMessage('Chưa có địa chỉ hiện tại, địa chỉ hiện tại cần được gửi với key là address')
    .notEmpty().withMessage('Vui lòng nhập địa chỉ hiện tại'),
]