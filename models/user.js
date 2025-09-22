const mongoose = require('mongoose');

const user = new mongoose.Schema({
    fullname: String,
    email: String,
    birthday: Date,
    phone: String,
    address: String,
    password: String,
    role: { type: Number, default: 1 }, // 0: Admin, 1: User
    created_at: { type: Date, default: Date },
}, { collection: 'user', versionKey: false });

const UserModel = mongoose.model('user', user);

module.exports = UserModel;