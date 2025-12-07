const mongoose = require("mongoose");

const medicalRecordSchema = new mongoose.Schema(
  {
    // Mã bệnh án duy nhất MRYYYYMMDD-ID (vd: MR20251013-00001)
    recordCode: { type: String, unique: true, sparse: true, trim: true },

    // Liên kết bệnh nhân
    patientID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "patient",
      required: true,
    },

    // Liên kết bác sĩ thực hiện
    doctorID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    // Thông tin khám bệnh
    visitDate: { type: Date, default: Date.now }, // Ngày khám
    reasonForVisit: { type: String, trim: true }, // Lý do đến khám
    symptoms: [{ type: String, trim: true }], // Triệu chứng bệnh nhân trình bày
    diagnosis: { type: String, trim: true }, // Chẩn đoán
    notes: { type: String, trim: true }, // Ghi chú thêm

    // Thông tin y tế tại thời điểm khám
    vitalSigns: {
      height: Number, // chiều cao (cm)
      weight: Number, // cân nặng (kg)
      temperature: Number, // nhiệt độ cơ thể (°C)
      bloodPressure: String, // huyết áp, vd: "120/80"
      pulse: Number, // nhịp tim (bpm)
    },

    // Điều trị & chỉ định
    prescribedMedications: [
      {
        name: { type: String, trim: true }, // Tên thuốc
        dosage: { type: String, trim: true }, // Liều lượng
        frequency: { type: String, trim: true }, // Tần suất sử dụng
        duration: { type: String, trim: true }, // Thời gian sử dụng
      },
    ],

    // Tái khám
    followUpDate: Date, // Ngày hẹn tái khám
    followUpNote: { type: String, trim: true }, // Ghi chú cho lần tái khám

    // Blockchain
    recordHash: String, // Hash lưu trên blockchain để đối chiếu (mỗi record 1 hash)
    lastVerifiedHash: String, // Hash đã xác minh trước đó, dùng để so sánh khi chỉnh sửa

    // Status
    status: String, // Trạng thái bệnh án , pending: chờ blockchain, verified: đã lưu blockchain

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: "medical-record", versionKey: false }
);

const MedicalRecordModel = mongoose.model(
  "medical-record",
  medicalRecordSchema
);
module.exports = MedicalRecordModel;
