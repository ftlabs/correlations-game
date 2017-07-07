const debug = require('debug')('bin:lib:game');
const uuid = require('uuid').v4;

const correlations_service = require('./correlations');

const runningGames = {};
const highScores = [];

/* 
Game class

UUID = uuid for this game
player = userUUID
state = What is the current state of play?
	- new - Game has not yet been started
	- current - game is in progress
	- finished - game has been completed
distance - the furthest distance achieved from the original (seed) person on the island
seedPerson - the person to start the game with. Initially undefined, but should be set on creation on game start.
*/

class Game{
	constructor(userUUID) {
		this.UUID = uuid();
		this.player = userUUID;
		this.state = 'new';
		this.score = 0;
		this.seedPerson = undefined;
		this.nextAnswer = undefined;
	}

	selectRandomSeedPerson(){
		return correlations_service.allIslands()
			.then(islands => {
				const biggestIsland = islands[0];
				const topFive = Object.keys(biggestIsland).map(person => {
						return {
							name : person,
							numberOfConnectionsToOthers : biggestIsland[person]
						}
					})
					.sort( (a, b) => {
						if(a.numberOfConnectionsToOthers >= b.numberOfConnectionsToOthers){
							return -1
						} else {
							return 1;
						}
					})
					.slice(0, 5)
				;

				debug(topFive);

				return topFive[ Math.random() * 5 | 0 ];

			})
	}

}

function createANewGame(userUUID){

	if(userUUID === undefined){
		return Promise.reject('No user UUID was passed to the function');
	}

	const newGame = new Game(userUUID);
	runningGames[newGame.UUID] = newGame;

	return newGame.selectRandomSeedPerson()
		.then(seedPerson => {
			newGame.seedPerson = seedPerson.name;
			debug(newGame);
			return newGame.UUID;
		})
	;

}

function getAQuestionToAnswer(gameUUID){

	if(gameUUID === undefined){
		return Promise.reject('No game UUID was passed to the function');
	} else if(runningGames[gameUUID] === undefined){
		return Promise.reject(`The game UUID '${gameUUID}' is not valid`);
	}

	return new Promise( (resolve, reject) => {

		const selectedGame = runningGames[gameUUID];
		debug(selectedGame);

		if(selectedGame.state === 'new'){
			selectedGame.state = 'current';
		}

		if(selectedGame.state === 'finished'){
			reject('This game has already been played to completion');
			return;
		}

		correlations_service.calcChainLengthsFrom(selectedGame.seedPerson)
			.then(data => {
				debug(data);

				selectedGame.nextAnswer = data[1].entities[Math.random() * data[1].entities.length | 0];

				let possibleAnswers = [selectedGame.nextAnswer, data[2].entities[Math.random() * data[2].entities.length | 0], data[3].entities[Math.random() * data[3].entities.length | 0]]

				possibleAnswers = possibleAnswers.sort(function(){
					return Math.random() > 0.5 ? 1 : -1;
				});
				
				resolve({
					seed : selectedGame.seedPerson,
					options : {
						a : possibleAnswers[0],
						b : possibleAnswers[1],
						c : possibleAnswers[2]
					}
				});
			})
		;


	});

}

function answerAQuestion(gameUUID, submittedAnswer){

	if(gameUUID === undefined){
		return Promise.reject('No game UUID was passed to the function');
	} else if(runningGames[gameUUID] === undefined){
		return Promise.reject(`The game UUID '${gameUUID}' is not valid`);
	} else if(submittedAnswer === undefined){
		return Promise.reject(`An answer was not passed to the function`);
	}
	
	const selectedGame = runningGames[gameUUID];

	if(submittedAnswer === selectedGame.nextAnswer){
		selectedGame.distance += 1;
		selectedGame.seedPerson = submittedAnswer;
		return Promise.resolve(true);
	} else {
		selectedGame.state = 'finished';
		return Promise.resolve(false);
	}

}

function getListOfHighScores(){

}

module.exports = {
	new : createANewGame,
	question : getAQuestionToAnswer,
	answer : answerAQuestion,
	highScores : getListOfHighScores
};