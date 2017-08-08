const debug = require('debug')('bin:middleware:log-requests');
const fetch = require('node-fetch');

module.exports = (req, res, next) => {

	debug('Logging request to:', req.originalUrl);
	next();

	const data = {
		'category': 'request',
		'action': req.originalUrl,
		'system': {
			'source': 'ftlabs-correlations-game'
		}
	};

	return fetch('https://spoor-api.ft.com/ingest', {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'Content-Length': new Buffer(JSON.stringify(data)).length
			},
			body: JSON.stringify(data)
		})
		.then(res => {
			if(res.ok){
				return res.text();
			} else {
				throw res;
			}
		})
		.then(r => debug(r))
		.catch(err => {
			debug('Request to Spoor failed:', err);
		})
	;

};