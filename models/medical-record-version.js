const mongoose = require("mongoose");

const medicalRecordVersionSchema = new mongoose.Schema(
  {
    medicalRecordID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "medical-record",
      required: true,
    },
    recordCode: { type: String, trim: true },
    version: { type: Number, required: true }, // Số phiên bản
    recordData: {
      reasonForVisit: String,
      symptoms: [String],
      diagnosis: String,
      notes: String,
      vitalSigns: {
        height: Number,
        weight: Number,
        temperature: Number,
        bloodPressure: String,
        pulse: Number,
      },
      prescribedMedications: [
        {
          name: String,
          dosage: String,
          frequency: String,
          duration: String,
        },
      ],
      followUpDate: Date,
      followUpNote: String,
    },
    recordHash: { type: String },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    createdAt: { type: Date, default: Date.now },
    rollbackFromVersion: { type: Number },
  },

  { collection: "medical-record-version", versionKey: false }
);

const MedicalRecordVersionModel = mongoose.model(
  "medical-record-version",
  medicalRecordVersionSchema
);
module.exports = MedicalRecordVersionModel;
