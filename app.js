const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const routeAuth = require('./bin/middleware/route-auth');

const app = express();

const userUUIDMiddleware = require('./bin/middleware/user-uuid');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));

//Use verify to append rawbody attribute to request before parse. 
//(Used by alexa route guard)
app.use(
	bodyParser.json({
		verify: function (req, res, buf) {
			req.rawBody = buf
		}
	}
	))
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(userUUIDMiddleware);

app.use('/', require('./routes/index'));
app.use('/voice', routeAuth, require('./routes/voice'));
app.use('/interface', require('./routes/interface'));
app.use('/alexa', routeAuth, require('./routes/voice-alexa').router);


// catch 404 and forward to error handler
app.use(function (req, res, next) {
	const err = new Error('Not Found');
	err.status = 404;
	next(err);
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
