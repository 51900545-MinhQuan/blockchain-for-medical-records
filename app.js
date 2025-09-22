require('dotenv').config();

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const credentials = require('./credentials.js');
const session = require('express-session');
const flash = require('express-flash');
const logger = require('morgan');
const moment = require('moment');

// Import DataBase
const db = require('./config/mongoose.js');

//Import Router
const authRouter = require('./routes/auth.js');
const indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin.js');

//Import Middleeare
const Auth = require('./middleware/auth.js');
const Permission = require('./middleware/permission.js');

const app = express();

//Set locals
app.locals.moment = moment;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(require('cookie-parser')(credentials.cookieSecret))
app.use(require('express-session')());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser('hospitalmedicalrecords'));
app.use(session({
  secret: 'hospitalmedicalrecords',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 6000 }
}));
app.use(flash());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth', authRouter);
app.use('/admin', Permission.Admin, adminRouter);
app.use('/', Auth.checkSession, Permission.User, indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
