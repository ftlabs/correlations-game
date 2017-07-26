const debug = require('debug')('bin:lib:game');
const uuid = require('uuid').v4;

const database = require('./database');
const correlations_service = require('./correlations');
const barnier = require('./barnier-filter'); // Filter names from the game that we know to not work - like Michel Barnier

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
nextAnswer - the correct answer for the seed person given. Also the next seed person is question is answered correctly
answersReturned - if the question has been requested more than once, the original set of answers (stored in this variable) will be returned instead of generating new ones for the seed person
blacklist - each seed person is added to this list so they cannot be the seed person in future questions
*/

class Game{
	constructor(userUUID) {
		this.uuid = userUUID;
		this.player = userUUID;
		this.state = 'new';
		this.distance = 0;
		this.seedPerson = undefined;
		this.nextAnswer = undefined;
		this.answersReturned = undefined;
		this.blacklist = [];
	}

	selectRandomSeedPerson(){
		return correlations_service.allIslands()
			.then(islands => {
				const biggestIsland = barnier.filter( Object.keys(islands[0]) );
				const mostConnectedIndividuals = biggestIsland.map(person => {
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

				debug('MOST CONNECTED', mostConnectedIndividuals);

				return mostConnectedIndividuals[ Math.random() * mostConnectedIndividuals.length | 0 ];

			})
		;
	}

}

function createANewGame(userUUID){

	if(userUUID === undefined){
		return Promise.reject('No user UUID was passed to the function');
	}

	const newGame = new Game(userUUID);

	return newGame.selectRandomSeedPerson()
		.then(seedPerson => {
			newGame.seedPerson = seedPerson.name;
			newGame.blacklist.push(seedPerson.name.toLowerCase());
			debug('NEW GAME SEED:: ', newGame);
		})
		.then(function(){
			return database.write(newGame, process.env.GAME_TABLE)
				.then(function(){
					return newGame.uuid;
				})
				.catch(err => {
					debug('Unable to store game instance in database:', err);
					throw err;
				})
			;
		})
	;

}

function getAQuestionToAnswer(gameUUID){

	debug(gameUUID);

	if(gameUUID === undefined){
		return Promise.reject('No game UUID was passed to the function');
	}

	return database.read({ uuid : gameUUID }, process.env.GAME_TABLE)
		.then(data => {
			if(data.Item === undefined){
				throw `The game UUID '${gameUUID}' is not valid`;
			}

			return new Promise( (resolve, reject) => {

				const selectedGame = data.Item;
				debug(selectedGame);

				if(selectedGame.state === 'new'){
					selectedGame.state = 'current';
				}

				if(selectedGame.state === 'finished'){
					reject('GAMEOVER');
					return;
				}

				if(selectedGame.answersReturned !== undefined){
					resolve({
						seed : selectedGame.seedPerson,
						options : selectedGame.answersReturned
					});
				} else {

					correlations_service.calcChainLengthsFrom(selectedGame.seedPerson)
						.then(data => {

							const possibleAlternatives = barnier.filter( data[1].entities );
							selectedGame.nextAnswer = Math.random() >= 0.5 ? possibleAlternatives.shift() : possibleAlternatives.pop();

							debug('First instance of nextAnswer', selectedGame.nextAnswer);
							debug('The possible alternatives are', possibleAlternatives);
							
							while(possibleAlternatives.length >= 0 && selectedGame.blacklist.indexOf(selectedGame.nextAnswer.toLowerCase()) > -1){
								debug(`Current nextAnswer (${selectedGame.nextAnswer}) is in blacklist`)
								selectedGame.nextAnswer = possibleAlternatives.pop();
								debug(`Setting ${selectedGame.nextAnswer} as nextAnswer`);
								
								if(selectedGame.nextAnswer === undefined){
									break;	
								}

							}

							if(selectedGame.nextAnswer === undefined){
								// The game is out of organic connections
								selectedGame.state = 'finished';
								database.write(selectedGame, process.env.GAME_TABLE)
									.then(function(){
										debug(`Game state (${selectedGame.uuid}) successfully updated on completion.`);
										resolve({
											limitReached : true,
											score : selectedGame.distance
										});	
									})
									.catch(err => {
										debug(`Unable to save game state (${selectedGame.uuid}) at limit reached`, err);
										throw err;
									});
								;
							} else {

								selectedGame.blacklist.push(selectedGame.nextAnswer.toLowerCase());

								debug(`BLACKLIST + ANSWER ${selectedGame.blacklist} ${selectedGame.nextAnswer.toLowerCase()}`);

								// Get the answer from the island 1 distance away, 
								// then get a wrong answer from the island 2 distance,
								// and then do the same 3 distance away.
								// Then randomise the order they're sent in.
								const possibleAnswers = [ 
									selectedGame.nextAnswer,
									data[2].entities[Math.random() * data[2].entities.length | 0],
									data[3].entities[Math.random() * data[3].entities.length | 0]
								].sort(function(){
									return Math.random() > 0.5 ? 1 : -1;
								});

								const answersToReturn = {
									a : possibleAnswers[0],
									b : possibleAnswers[1],
									c : possibleAnswers[2]
								};

								selectedGame.answersReturned = answersToReturn;

								debug('SELECTEDGAME', selectedGame);

								correlations_service.calcChainWithArticlesBetween(selectedGame.seedPerson, selectedGame.nextAnswer)
									.then(data => {

										selectedGame.linkingArticles = data.articlesPerLink[0];

										database.write(selectedGame, process.env.GAME_TABLE)
											.then(function(){
												debug(`Game state (${selectedGame.uuid}) successfully updated on generation of answers.`);
												resolve({
													seed : selectedGame.seedPerson,
													options : answersToReturn,
													limitReached : false
												});
											})
											.catch(err => {
												debug(`Unable to save game state whilst returning answers`, err);
												throw err;
											})
										;

									})
									.catch(err => {
										debug(`Unable to articles between ${selectedGame.seedPerson} and ${selectedGame.nextAnswer}`, err);
										throw err;
									})
								;
							}

						})
					;

				}

			});

		})
	;

}

function answerAQuestion(gameUUID, submittedAnswer){

	if(gameUUID === undefined){
		return Promise.reject('No game UUID was passed to the function');
	} else if(submittedAnswer === undefined){
		return Promise.reject(`An answer was not passed to the function`);
	}
	
	return database.read({ uuid : gameUUID }, process.env.GAME_TABLE)
		.then(data => {
			if(data.Item === undefined){
				throw `The game UUID '${gameUUID}' is not valid`;
			}

			return new Promise( (resolve) => {

				const selectedGame = data.Item;

				if(submittedAnswer.replace('.', '').replace('-', ' ').toLowerCase() === selectedGame.nextAnswer.replace('.', '').replace('-', ' ').toLowerCase()){
					
					selectedGame.distance += 1;
					selectedGame.seedPerson = selectedGame.nextAnswer;
					selectedGame.answersReturned = undefined;

					database.write(selectedGame, process.env.GAME_TABLE)
						.then(function(){
							resolve({
								correct : true,
								score : selectedGame.distance,
								linkingArticles : selectedGame.linkingArticles
							});
						})
						.catch(err => {
							debug(`Unable to save game state (${selectedGame.uuid}) on correct answering of question`, err);
							throw err;
						})
					;

				} else {
					selectedGame.state = 'finished';

					let scorePosition = -1;

					if(highScores.length >= 1){

						for(let x = 0; x < highScores.length; x += 1){

							if(selectedGame.distance > highScores[x].distance){
								scorePosition = x;
								break;
							}

						}

						if(scorePosition !== -1){
							highScores.splice(scorePosition, 0, selectedGame);

							if(highScores.length > 10){
								for(let y = highScores.length - 10; y > 0; y -= 1){
									highScores.pop();
								}
							}

						}

					} else {
						highScores.push(selectedGame);
					}

					database.write(selectedGame, process.env.GAME_TABLE)
						.then(function(){
							resolve({
								correct : false,
								score : selectedGame.distance,
								expected: selectedGame.nextAnswer.replace('people:', ''),
								linkingArticles : selectedGame.linkingArticles
							});
						})
						.catch(err => {
							debug(`Unable to save game state (${selectedGame.uuid}) on incorrect answering of question`, err);							
							throw err;
						})
					;
				
				}

			} );

		})
	;

}

function getListOfHighScores(){

	return new Promise( (resolve) => {

		debug(`HIGH SCORES ${highScores}`);

		const sanitizedHighScores = highScores.map(score => {
			return {
				userUUID : score.userUUID,
				score : score.distance
			};
		});

		resolve(sanitizedHighScores);

	});

}

function checkIfAGameExistsForAGivenUUID(gameUUID){

	debug(`Checking gameUUID ${gameUUID}`);

	return new Promise( (resolve) => {

		if(gameUUID === undefined){
			resolve(false);
		} else {
			database.read({ uuid : gameUUID }, process.env.GAME_TABLE)
				.then(data => {
					if(data.Item === undefined){
						resolve(false);
					} else if(data.Item.state === 'finished'){
						resolve(false);
					} else {
						resolve(true);
					}
				})
				.catch(err => {
					debug(`Unable to check if game (${gameUUID}) exists`, err);
					throw err;
				})
			;
		}

	});

}

function getGameDetails(gameUUID){

	if(gameUUID === undefined){
		throw 'No gameUUID was passed to the function';
	}

	// return Promise.resolve( Object.assign({}, runningGames[gameUUID]) );
	return database.read({ uuid : gameUUID }, process.env.GAME_TABLE)
		.then(data => data.Item)
		.catch(err => {
			debug(`Unable to read entry for game ${gameUUID}`, err);
			throw err;
		})
	;
}

module.exports = {
	new : createANewGame,
	question : getAQuestionToAnswer,
	answer : answerAQuestion,
	highScores : getListOfHighScores,
	check : checkIfAGameExistsForAGivenUUID,
	get : getGameDetails
};