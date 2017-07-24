const debug = require('debug')('bin:lib:correlations');
const fetch = require('node-fetch');

const CORRELATION_SERVICE_HOST = process.env.CORRELATION_SERVICE_HOST;
const CORRELATIONS_SERVICE_TOKEN = process.env.CORRELATIONS_SERVICE_TOKEN;

const REQUEST_HEADERS = {
	method: 'GET',
	headers: {
		'Content-Type': 'application/json',
		'token': CORRELATIONS_SERVICE_TOKEN
	}
};

function getAllOfTheIslandsInTheCorrelationsService(){
	return fetch(`https://${CORRELATION_SERVICE_HOST}/allIslands`, REQUEST_HEADERS)
		.then(res => {
			if(res.ok){
				return res.json();
			} else {
				throw res;
			}
		})
		.catch(err => {
			debug(err); //Log the error here, catch it in the application
			throw err;
		})
	;

}

function getListOfPeopleOnAPersonsIsland(personName){

	return fetch(`https://${CORRELATION_SERVICE_HOST}/islandOf/${ encodeURIComponent( personName ) }`, REQUEST_HEADERS)
		.then(res => {
			if(res.ok){
				return res.json();
			} else {
				throw res;
			}
		})
		.catch(err => {
			debug(err); //Log the error here, catch it in the application
			throw err;
		})
	;

}

function getListOfPeopleByDistances(personName){
	return fetch(`https://${CORRELATION_SERVICE_HOST}/calcChainLengthsFrom/${ encodeURIComponent( personName ) }`, REQUEST_HEADERS)
		.then(res => {
			if(res.ok){
				return res.json();
			} else {
				throw res;
			}
		})
		.then(data => {
			debug(data);
			return data.chainLengths;
		})
		.catch(err => {
			debug(err); //Log the error here, catch it in the application
			throw err;
		})
	;

}

function getAChainBetweenTwoPeopleAndIncludeTheArticles(personOne, personTwo){
	return fetch(`https://${CORRELATION_SERVICE_HOST}/calcChainWithArticlesBetween/${ encodeURIComponent( personOne ) }/${ encodeURIComponent( personTwo ) }`, REQUEST_HEADERS)
		.then(res => {
			if(res.ok){
				return res.json();
			} else {
				throw res;
			}
		})
		.catch(err => {
			debug(err); //Log the error here, catch it in the application
			throw err;
		})
	;
}

module.exports = {
	allIslands : getAllOfTheIslandsInTheCorrelationsService,
	islandOf : getListOfPeopleOnAPersonsIsland,
	calcChainLengthsFrom : getListOfPeopleByDistances,
	calcChainWithArticlesBetween : getAChainBetweenTwoPeopleAndIncludeTheArticles
};