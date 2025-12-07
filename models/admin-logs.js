const mongoose = require("mongoose");

const adminLogSchema = new mongoose.Schema(
  {
    event: String,
    data: Object,
    created_at: { type: Date, default: Date.now },
  },
  { collection: "admin-log", versionKey: false }
);

const AdminLogModel = mongoose.model("admin-log", adminLogSchema);
module.exports = AdminLogModel;
