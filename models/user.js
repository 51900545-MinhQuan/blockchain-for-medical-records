const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullname: String,
    email: { type: String, unique: true },
    birthday: Date,
    phone: String,
    identificationNumber: { type: String, unique: true },
    address: String,
    password: String,
    role: { type: Number, default: 1 }, // 0: Admin, 1: User, 2: Doctor
    created_at: { type: Date, default: Date.now },
  },
  { collection: "user", versionKey: false }
);

// Liên kết tài khoản user với bệnh nhân sau khi lưu
userSchema.post("save", async function (user, next) {
  try {
    const existingPatient = await mongoose.model("patient").findOne({
      $or: [
        { identificationNumber: user.identificationNumber },
        { guardianIdentification: user.identificationNumber },
        { phone: user.phone },
        { guardianPhone: user.phone },
      ],
    });

    if (existingPatient && !existingPatient.linkedUserID) {
      existingPatient.linkedUserID = user._id;
      await existingPatient.save();
      console.log(
        `Liên kết tài khoản ${user.email} với bệnh nhân ${existingPatient.patientCode}`
      );
    }
  } catch (err) {
    console.error("Có lỗi xảy ra khi liên kết tài khoản với bệnh nhân:", err);
  }
  next();
});

const UserModel = mongoose.model("user", userSchema);
module.exports = UserModel;
