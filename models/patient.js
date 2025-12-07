const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    // Mã bệnh nhân duy nhất P-ID (vd: P-00000001)
    patientCode: { type: String, unique: true, trim: true },
    //Thông tin cá nhân
    fullname: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    birthday: { type: Date, required: true },
    gender: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    identificationNumber: { type: String, trim: true }, //CMND/CCCD
    //Thông tin người giám hộ
    guardianName: { type: String, trim: true }, //Tên người giám hộ
    guardianPhone: { type: String, trim: true }, //SĐT người giám hộ
    guardianIDNumber: { type: String, trim: true }, //CMND/CCCD người giám hộ
    usingGuardianWallet: { type: Boolean, default: false }, //Sử dụng ví người giám hộ
    //Thông tin y tế
    bloodType: { type: String, trim: true },
    allergies: { type: String, trim: true }, //dị ứng
    chronicDiseases: { type: String, trim: true }, //bệnh mãn tính
    //Liên kết bệnh án và user
    medicalRecordID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "medical_record",
    }, //lần khám gần nhất
    linkedUserID: { type: mongoose.Schema.Types.ObjectId, ref: "user" },

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: "patient", versionKey: false }
);


const PatientModel = mongoose.model("patient", patientSchema);
module.exports = PatientModel;
