const debug = require('debug')('bin:middleware:log-requests');
const fetch = require('node-fetch');

module.exports = function(data){

	if(!data){
		return Promise.resolve({'status' : 'Failed. Invalid data passed.'});
	}

	console.log('Sending data to spoor', data);

	return fetch('https://spoor-api.ft.com/ingest', {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'Content-Length': new Buffer(JSON.stringify(data)).length,
				'spoor-ticket': '07235218-afa1-4033-9afa-3be3ce8175ac'
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
			console.log('Data successfully submitted to Spoor', r);
			return r;
		})
		.catch(err => {
			console.log('Request to Spoor failed:', err);
		})
	;

};