const debug = require('debug')('bin:lib:correlations');
const fetch = require('node-fetch');

const CORRELATION_SERVICE_HOST = process.env.CORRELATION_SERVICE_HOST;
const CORRELATIONS_SERVICE_TOKEN = process.env.CORRELATIONS_SERVICE_TOKEN;

if (CORRELATION_SERVICE_HOST == undefined) {
	throw 'CORRELATION_SERVICE_HOST undefined';
}
if (CORRELATIONS_SERVICE_TOKEN == undefined) {
	throw 'CORRELATIONS_SERVICE_TOKEN undefined';
}

const REQUEST_HEADERS = {
	method: 'GET',
	headers: {
		'Content-Type': 'application/json',
		'token': CORRELATIONS_SERVICE_TOKEN
	}
};

const CALL_STATS = {};

function updateStats(fnName, startTimeMillis){
	if (!CALL_STATS.hasOwnProperty(fnName)) {
		CALL_STATS[fnName] = {
			durations : []
		};
	}
	const duration = Date.now() - startTimeMillis;
	CALL_STATS[fnName].durations.push(duration);
	const mostRecentDurations = CALL_STATS[fnName].durations.slice(-10);
	const sumDurations = mostRecentDurations.reduce((sum, val)=>{ return sum+val; });
	const avgDuration = sumDurations / mostRecentDurations.length;
	const maxDuration = Math.max(...mostRecentDurations);
	debug(`updateStats: fnName=${fnName}, duration=${duration}, avgDuration=${avgDuration}, maxDuration=${maxDuration}`);
}

function getAllOfTheIslandsInTheCorrelationsService(){
	debug(`getAllOfTheIslandsInTheCorrelationsService:`);
	const startTimeMillis = Date.now();
	return fetch(`https://${CORRELATION_SERVICE_HOST}/allIslands`, REQUEST_HEADERS)
		.then(res => {
			updateStats('allIslands', startTimeMillis);
			if(res.ok){
				return res.json();
			} else {
				throw res;
			}
		})
		.catch(err => {
			debug(`getAllOfTheIslandsInTheCorrelationsService: err=${err}`); //Log the error here, catch it in the application
			throw err;
		})
	;

}

function getListOfPeopleOnAPersonsIsland(personName){
	debug(`getListOfPeopleOnAPersonsIsland: personName=${personName}`);
	const startTimeMillis = Date.now();
	return fetch(`https://${CORRELATION_SERVICE_HOST}/islandOf/${ encodeURIComponent( personName ) }`, REQUEST_HEADERS)
		.then(res => {
			updateStats('islandOf', startTimeMillis);
			if(res.ok){
				return res.json();
			} else {
				throw res;
			}
		})
		.catch(err => {
			debug(`getListOfPeopleOnAPersonsIsland: err=${err}`); //Log the error here, catch it in the application
			throw err;
		})
	;

}

function getListOfPeopleByDistances(personName){
	debug(`getListOfPeopleByDistances: personName=${personName}`);
	const startTimeMillis = Date.now();
	return fetch(`https://${CORRELATION_SERVICE_HOST}/calcChainLengthsFrom/${ encodeURIComponent( personName ) }`, REQUEST_HEADERS)
		.then(res => {
		updateStats('calcChainLengthsFrom', startTimeMillis);
		if(res.ok){
				return res.json();
			} else {
				throw res;
			}
		})
		.then(data => {
			return data.chainLengths;
		})
		.catch(err => {
			debug(`getListOfPeopleByDistances: err=${err}`); //Log the error here, catch it in the application
			throw err;
		})
	;

}

function getAChainBetweenTwoPeopleAndIncludeTheArticles(personOne, personTwo){
	debug(`getAChainBetweenTwoPeopleAndIncludeTheArticles: personOne=${personOne}, personTwo=${personTwo}`);
	const startTimeMillis = Date.now();
	return fetch(`https://${CORRELATION_SERVICE_HOST}/calcChainWithArticlesBetween/${ encodeURIComponent( personOne ) }/${ encodeURIComponent( personTwo ) }`, REQUEST_HEADERS)
		.then(res => {
			updateStats('calcChainWithArticlesBetween', startTimeMillis);
			if(res.ok){
				return res.json();
			} else {
				throw res;
			}
		})
		.catch(err => {
			debug(`getAChainBetweenTwoPeopleAndIncludeTheArticles: err=${err}`); //Log the error here, catch it in the application
			throw err;
		})
	;
}

function getBiggestIsland(){
	debug(`getBiggestIsland:`);
	const startTimeMillis = Date.now();
	return fetch(`https://${CORRELATION_SERVICE_HOST}/biggestIsland`, REQUEST_HEADERS)
		.then(res => {
			updateStats('biggestIsland', startTimeMillis);
			if(res.ok){
				return res.json();
			} else {
				throw res;
			}
		})
		.catch(err => {
			debug(`getBiggestIsland: err=${err}`); //Log the error here, catch it in the application
			throw err;
		})
	;
}

function getSummary(){
	debug(`getSummary:`);
	const startTimeMillis = Date.now();
	return fetch(`https://${CORRELATION_SERVICE_HOST}/summary`, REQUEST_HEADERS)
		.then(res => {
			updateStats('summary', startTimeMillis);
			if(res.ok){
				return res.json();
			} else {
				throw res;
			}
		})
		.catch(err => {
			debug(`getSummary: err=${err}`); //Log the error here, catch it in the application
			throw err;
		})
	;
}

module.exports = {
	allIslands                   : getAllOfTheIslandsInTheCorrelationsService,
	islandOf                     : getListOfPeopleOnAPersonsIsland,
	calcChainLengthsFrom         : getListOfPeopleByDistances,
	calcChainWithArticlesBetween : getAChainBetweenTwoPeopleAndIncludeTheArticles,
	biggestIsland                : getBiggestIsland,
	summary                      : getSummary,
};
