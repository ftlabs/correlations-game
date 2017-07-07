const debug = require('debug')('bin:lib:correlations');
const uuid = require('uuid').v4;

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
seedPerson - the person whose island we're starting on.
*/

Class Game(){
	constructor(userUUID) {
		this.UUID = uuid();
		this.player = userUUID;
		this.state = 'new';
		this.distance = 0;
		this.seedPerson = 'Donald Trump'
	}
}

function startANewGame(userUUID){

	const newGame = new Game(userUUID);
	runningGames[newGame.UUID] = newGame;

	return newGame.UUID;

}

function answerAQuestion(gameUUID){

}

function getAQuestionToAnswer(gameUUID){

}

function getListOfHighScores(){

}

module.exports = {
	start : startANewGame,
	answer : answerAQuestion,
	question : getAQuestionToAnswer,
	highScores : getListOfHighScores
};