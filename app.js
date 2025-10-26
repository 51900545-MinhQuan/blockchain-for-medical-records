require('dotenv').config();

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('express-flash');
const logger = require('morgan');
const moment = require('moment');
const argon2 = require('argon2');

// Import DataBase
const db = require('./config/mongoose.js');

// Import Model 
const UserModel = require('./models/user');

//Import Router
const authRouter = require('./routes/auth.js');
const indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin.js');
const doctorRouter = require('./routes/doctor.js');

//Import Middleeare
const Auth = require('./middleware/auth.js');
const Permission = require('./middleware/permission.js');

const app = express();

//Set locals
app.locals.moment = moment;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// if (app.get('env') === 'development') {
//   app.use(logger('dev'));
// }
// Enable khi cần bảo mật nâng cao
// app.use(helmet()); // Enable all default Helmet protections
// // Configure CSP specifically. This is a placeholder; actual values depend on your assets.
// app.use(helmet.contentSecurityPolicy({
//   directives: {
//     defaultSrc: ["'self'"],
//     scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.example.com"], // Adjust as needed
//     styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.example.com"], // Adjust as needed
//     imgSrc: ["'self'", "data:", "https://img.example.com"], // Adjust as needed
//   },
// }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'hospitalmedicalrecords'));
app.use(session({
  secret: process.env.COOKIE_SECRET || 'hospitalmedicalrecords',
  resave: false,
  saveUninitialized: false, 
  cookie: { maxAge: 60 * 60 * 1000 }, // 1h
  store: MongoStore.create({
    client: db.getClient(),
    collectionName: 'sessions',
    stringify: false
  })
}));
app.use(flash());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth', authRouter);
app.use('/admin', Permission.Admin, adminRouter);
app.use('/doctor', Auth.checkSession, Permission.Doctor, doctorRouter);
app.use('/', Auth.checkSession, Permission.User, indexRouter);

// Tạo tài khoản admin mặc định nếu chưa tồn tại
db.once('open', async () => {
  try {
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL;
    const adminExists = await UserModel.findOne({ email: adminEmail });

    if (!adminExists) {
      const password = process.env.DEFAULT_ADMIN_PASSWORD;
      if (!password) {
        console.error('Lỗi: Biến môi trường DEFAULT_ADMIN_PASSWORD không được đặt. Không thể tạo tài khoản admin mặc định.');
        return;
      }
      const hashedPassword = await argon2.hash(password);
      await UserModel.create({
        fullname: 'Quản trị viên',
        email: adminEmail,
        password: hashedPassword,
        role: 0
      });
      console.log('Tài khoản admin mặc định đã được tạo.');
    }
  } catch (error) {
    console.error('Lỗi khi tạo tài khoản admin mặc định:', error);
  }
});

app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
