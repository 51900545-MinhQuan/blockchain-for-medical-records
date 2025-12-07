const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    // Mã bác sĩ duy nhất DOC-ID (vd: DOC-00000001)
    doctorCode: { type: String, unique: true, trim: true },
    userID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
    },
    accessibleRecords: [
      {
        recordCode: {
          type: String,
          trim: true,
          required: true,
        },
        patientCode: {
          type: String,
          trim: true,
          required: true,
        },
      },
    ], // Danh sách mã hồ sơ bệnh án cùng với mã bệnh nhân được cấp quyền truy cập
    walletAddress: { type: String, trim: true }, //Địa chỉ ví blockchain
    specialization: { type: String, required: true, trim: true }, // Chuyên khoa
    licenseNumber: { type: String, required: true, unique: true, trim: true }, // Số giấy phép hành nghề
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: "doctor", versionKey: false }
);

const DoctorModel = mongoose.model("doctor", doctorSchema);
module.exports = DoctorModel;
