const mongoose = require("mongoose");
const { URI_MONGODB } = process.env;

mongoose.connect(URI_MONGODB);
const db = mongoose.connection;

db.on("error", console.error.bind(console, "Lỗi kết nối đến cở sở dữ liệu!"));
db.once("open", function () {
  console.log("Kết nối cơ sở dữ liệu thành công!");
});

module.exports = db;
