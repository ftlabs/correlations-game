const debug = require('debug')('bin:middleware:log-requests');
const fetch = require('node-fetch');

module.exports = function(data){

	if(!data){
		return Promise.resolve({'status' : 'Failed. Invalid data passed.'});
	}

	debug('Sending data to spoor', data);

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
				return res.json();
			} else {
				throw res;
			}
		})
		.then(r => {
			debug('Data successfully submitted to Spoor', r);
			return r;
		})
		.catch(err => {
			debug('Request to Spoor failed:', err);
		})
	;

};