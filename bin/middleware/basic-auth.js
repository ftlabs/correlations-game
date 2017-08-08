const debug = require('debug')('bin:middleware:basic-auth');
const basicAuth = require('basic-auth');

module.exports = (req, res, next) => {

	const creds = basicAuth(req);
	debug(creds);
	if (!creds) {
		res.statusCode = 401
		res.setHeader('WWW-Authenticate', 'Basic realm="example"');
		res.end();
	} else if(creds.name === process.env.BASIC_AUTH_USERNAME && creds.pass === process.env.BASIC_AUTH_PASSWORD){
		next();
	} else {
		res.status = 400;
		res.json({
			status : 'err',
			message : 'Invalid basic authorisation credentials passed'
		});
	}

};