const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema({
  // Mã bệnh án duy nhất MRYYYYMMDD-ID (vd: MR20251013-00001) 
  recordCode: { type: String, unique: true, sparse: true },

  // Liên kết bệnh nhân
  patientID: { type: mongoose.Schema.Types.ObjectId, ref: 'patient', required: true },

  // Liên kết bác sĩ thực hiện
  doctorID: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },

  // Thông tin khám bệnh
  visitDate: { type: Date, default: Date.now },     // Ngày khám
  reasonForVisit: String,                           // Lý do đến khám
  symptoms: [String],                               // Triệu chứng bệnh nhân trình bày
  diagnosis: String,                                // Chẩn đoán
  notes: String,                                    // Ghi chú thêm

  // Thông tin y tế tại thời điểm khám
  vitalSigns: {
    height: Number,     // chiều cao (cm)
    weight: Number,     // cân nặng (kg)
    temperature: Number,// nhiệt độ cơ thể (°C)
    bloodPressure: String, // huyết áp, vd: "120/80"
    pulse: Number,      // nhịp tim (bpm)
  },

  // Điều trị & chỉ định
  prescribedMedications: [{
    name: String, // Tên thuốc
    dosage: String, // Liều lượng
    frequency: String, // Tần suất sử dụng
    duration: String, // Thời gian sử dụng
  }],

  // Tái khám
  followUpDate: Date,   // Ngày hẹn tái khám
  followUpNote: String, // Ghi chú cho lần tái khám

  // Blockchain
  blockchainHash: String,   // Hash lưu trên blockchain (mỗi record 1 hash)

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: 'medical-record', versionKey: false });

const MedicalRecordModel = mongoose.model('medical-record', medicalRecordSchema);
module.exports = MedicalRecordModel;
