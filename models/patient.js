const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
    // Mã bệnh nhân duy nhất P-ID (vd: P-00000001)
    patientCode: {type: String, unique: true},
    //Thông tin cá nhân
    fullname: {type: String, required: true},
    email: String,
    birthday: {type: Date, required: true},
    gender: {type: String, required: true},
    phone: {type: String, required: true},
    address: String,
    identificationNumber: String, //CMND/CCCD 
    //Thông tin người giám hộ
    guardianName: String, //Tên người giám hộ
    guardianPhone: String, //SĐT người giám hộ
    guardianIDNumber: String, //CMND/CCCD người giám hộ
    //Thông tin y tế
    bloodType: String,
    allergies: String, //dị ứng
    chronicDiseases: String, //bệnh mãn tính
    //Liên kết bệnh án và user
    medicalRecordID: {type: mongoose.Schema.Types.ObjectId, ref: 'medical_record'}, //lần khám gần nhất
    linkedUserID: {type: mongoose.Schema.Types.ObjectId, ref: 'user'},

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
}, { collection: 'patient', versionKey: false });

// Liên kết bệnh nhân với tài khoản user sau khi lưu
patientSchema.post('save', async function (patient, next) {
  try {
    if (!patient.linkedUserID) {
      const existingUser = await mongoose.model('user').findOne({
        $or: [
          { identificationNumber: patient.identificationNumber },
          { identificationNumber: patient.guardianIDNumber },
          { phone: patient.phone },
          { phone: patient.guardianPhone }
        ]
      });

      if (existingUser) {
        patient.linkedUserID = existingUser._id;
        await patient.save();
        console.log(`Liên kết bệnh nhân ${patient.patientCode} với tài khoản ${existingUser.email}`);
      }
    }
  } catch (err) {
    console.error('Có lỗi xảy ra khi liên kết bệnh nhân với tài khoản:', err);
  }
  next();
});

const PatientModel = mongoose.model('patient', patientSchema);
module.exports = PatientModel;