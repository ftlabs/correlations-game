const debug = require('debug')('bin:lib:correlations');
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
	}

	selectRandomSeedPerson(){
		return correlations_service.allIslands()
			.then(islands => {
				const biggestIsland = islands[0];
				const topFive = Object.keys(biggestIsland).map(person => {
						return {
							name : person.replace('people:', ''),
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

	const newGame = new Game(userUUID);
	runningGames[newGame.UUID] = newGame;

	return newGame.selectRandomSeedPerson()
		.then(seedPerson => {
			newGame.seedPerson = seedPerson;
			debug(newGame);
			return newGame.UUID;
		})
	;

}

function answerAQuestion(gameUUID){

}

function getAQuestionToAnswer(gameUUID){

}

function getListOfHighScores(){

}

module.exports = {
	new : createANewGame,
	answer : answerAQuestion,
	question : getAQuestionToAnswer,
	highScores : getListOfHighScores
};