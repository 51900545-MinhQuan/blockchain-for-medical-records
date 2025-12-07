const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullname: { type: String, trim: true },
    email: { type: String, unique: true, trim: true },
    birthday: Date,
    phone: { type: String, trim: true },
    identificationNumber: { type: String, unique: true, trim: true },
    address: { type: String, trim: true },
    password: String,
    role: { type: Number, default: 1 }, // 0: Admin, 1: User, 2: Doctor
    walletAddress: { type: String, trim: true }, //Địa chỉ ví blockchain
    linkedPatientCode: [{ type: String, trim: true }], //Mã bệnh nhân nếu có liên kết
    linkedDoctorCode: { type: String, trim: true }, //Mã bác sĩ nếu có liên kết
    created_at: { type: Date, default: Date.now },
  },
  { collection: "user", versionKey: false }
);

const UserModel = mongoose.model("user", userSchema);
module.exports = UserModel;
