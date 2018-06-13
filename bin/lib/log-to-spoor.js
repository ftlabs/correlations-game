const debug = require('debug')('bin:middleware:log-requests');
const fetch = require('node-fetch');
const IS_TEST_MODE = process.env.hasOwnProperty("TEST_MODE") ? (process.env.TEST_MODE == 'true' ? true : false) : false;

module.exports = function(data){

	if(IS_TEST_MODE) return Promise.resolve({'status' : 'Test Mode: Skipping spore submission'})

	if(!data){
		return Promise.resolve({'status' : 'Failed. Invalid data passed.'});
	}

	debug('Sending data to spoor', data);

	return fetch('https://spoor-api.ft.com/ingest', {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'Content-Length': new Buffer(JSON.stringify(data)).length,
				'User-Agent': 'ft-labs/v1.0'
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