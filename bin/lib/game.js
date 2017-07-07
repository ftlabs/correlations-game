const debug = require('debug')('bin:lib:correlations');

const runningGames = {};
const highScores = [];

function startANewGame(userUUID){

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