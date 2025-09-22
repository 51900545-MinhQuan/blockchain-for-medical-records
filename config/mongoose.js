const mongoose = require('mongoose');
const {URI_MONGODB} = process.env;

// connect to the database
mongoose.connect(URI_MONGODB);
const db = mongoose.connection;
// error
db.on('error', console.error.bind(console, 'Lỗi kết nối đến cở sở dữ liệu!'));
// success
db.once('open', function () { console.log('Kết nối cơ sở dữ liệu thành công!'); });
// exporting the database
module.exports = db;