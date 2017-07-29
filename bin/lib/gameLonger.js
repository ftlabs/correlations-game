const debug = require('debug')('bin:lib:gameLonger');
const uuid = require('uuid').v4;

// const database = require('./database');
const database = (process.env.DATABASE == 'PRETEND')? require('./database_pretend') : require('./database');
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
		this.uuid     = userUUID;
		this.player   = userUUID;
		this.state    = 'new';
		this.distance = 0;
		this.seedPerson          = undefined;
		this.nextAnswer          = undefined;
		this.answersReturned     = undefined;
		this.linkingArticles     = undefined;
		this.blacklist           = []; // will hold all non-available candidates, including chosen seeds, barnier, dead-ends, etc, also populated in createAnNewGame
		this.remainingCandidatesWithConnections = []; // to be populated in createANewGame
		this.intervalDays        = undefined;
		this.history             = [];

		barnier.list().forEach(uuid => {this.addToBlacklist(uuid);});
	}

	addToBlacklist(name) { return this.blacklist.push( name.toLowerCase() ) };
	isBlacklisted(name) { return this.blacklist.indexOf( name.toLowerCase() ) > -1; };
	filterBlacklisted(names) { return names.filter( name => {return !this.isBlacklisted(name);}) };

	addCandidates( candidates ) {
		let count = 0;
		candidates.forEach( cand => {
			if (! this.isBlacklisted(cand[0])) {
				this.remainingCandidatesWithConnections.push(cand);
				count = count + 1;
			}
		});
		debug(`Game.addCandidates: added ${count}`);
	}

	blacklistCandidate(name){
		let candIndex = -1; // locate candidate in list
		this.remainingCandidatesWithConnections.some( (cand, i) => {
			if (cand[0] == name) {
				candIndex = i;
				return true;
			} else {
				return false;
			}
		} );

		if (candIndex >= 0) {
			this.remainingCandidatesWithConnections.splice(candIndex, 1)
		}

		this.addToBlacklist( name );
		debug(`Game.blacklistCandidate: name=${name}`);
	}

	pickFromFirstFew(items, max=5){
		if (items.length == 0) {
			debug(`Game.pickFromFirstFew: items.length == 0`);
			return undefined;
		}
		const range = Math.min(max, items.length);
		const index = Math.floor(Math.random()*range);
		const item  = items[index];
		debug(`Game.pickFromFirstFew: items.length=${items.length}, range=${range}, index=${index}, item=${item}`);
		return item;
	}

	pickNameFromTopFewCandidates(max=5){
		if(this.remainingCandidatesWithConnections.length < 4) {
			return undefined; // must have at least 4 people left: seed + 3 answers
		}
		const candidate = this.pickFromFirstFew( this.remainingCandidatesWithConnections );
		debug(`Game.pickNameFromTopFewCandidates: candidate=${candidate}`);
		return (candidate==undefined)? undefined : candidate[0];
	}

	clearQuestion(){
		this.seedPerson      = undefined;
		this.answersReturned = undefined;
		this.nextAnswer      = undefined;
		this.linkingArticles = undefined;
	}

	shuffle(arr) {
	    let i, j, temp;
	    for (i = arr.length - 1; i > 0; i--) {
	        j = Math.floor(Math.random() * (i + 1));
	        temp = arr[i];
	        arr[i] = arr[j];
	        arr[j] = temp;
	    }
	    return arr;
	}

	// involves a recursive use of Promises. Oooh. Not sure if that is A Bad Thing.
	// Basic alg:
	// - start with a list of candidates, sorted by num connections (highest first)
	// - pick one of the first few as a potential seedPerson
	//   - get the chainLengths info from the service for that seedPerson
	//   - check we have enough links in the chain (need at least 4)
	//   - pick a nextAnswer from the 2nd link in the chain
	//   - pick a wrongAnswer from the 3rd link
	//   - pick a wrongAnswer from the 4th link
	//   - get the linkingArticles between seedPerson and the nextAnswer
	//   - construct and return the question data structure
	// - if any of the steps after picking a potential seedPerson fails
	//   - blacklist the seedPerson
	//   - recursively call this fn again (to try another seedPerson)
	// - if we run out of candidates, return undefined

	promiseNextCandidateQuestion(){
		debug(`promiseNextCandidateQuestion: start`);
		let question = {
			seedPerson     : undefined,
			nextAnswer     : undefined,
			wrongAnswers   : [],
			answersReturned: undefined,
			linkingArticles: undefined,
		};

		return Promise.resolve( this.pickNameFromTopFewCandidates() )
		.then( name => {
			if (name == undefined) { return undefined; }
			question.seedPerson = name;

			return correlations_service.calcChainLengthsFrom(name)
			.then(chainLengths => {
				if (chainLengths.length < 4) {
					this.blacklistCandidate(question.seedPerson);
					return this.promiseNextCandidateQuestion();
				}
				const nextAnswers = this.filterBlacklisted( chainLengths[1].entities );
				if (nextAnswers.length == 0) {
					this.blacklistCandidate(question.seedPerson);
					return this.promiseNextCandidateQuestion();
				}
				question.nextAnswer = this.pickFromFirstFew( nextAnswers );
				const wrongAnswers1 = this.filterBlacklisted( chainLengths[2].entities );
				if (wrongAnswers1.length == 0) {
					this.blacklistCandidate(question.seedPerson);
					return this.promiseNextCandidateQuestion();
				}
				question.wrongAnswers.push( this.pickFromFirstFew( wrongAnswers1 ) );
				const wrongAnswers2 = this.filterBlacklisted( chainLengths[3].entities );
				if (wrongAnswers2.length == 0) {
					this.blacklistCandidate(question.seedPerson);
					return this.promiseNextCandidateQuestion();
				}
				question.wrongAnswers.push( this.pickFromFirstFew( wrongAnswers2 ) );
				// yay, means we have all the bits needed for a valid question
				question.answersReturned = question.wrongAnswers.slice(0);
				question.answersReturned.push(question.nextAnswer);
				this.shuffle( question.answersReturned );
				return correlations_service.calcChainWithArticlesBetween(question.seedPerson, question.nextAnswer)
				.then( data => {
					question.linkingArticles = data.articlesPerLink[0];
					return question;
				})
				.catch(err => {
					debug(`promiseNextCandidateQuestion: Unable to fetch articles between ${question.seedPerson} and ${question.nextAnswer}`, err);
					throw err;
				})
				;
			})
			;
		})
		;
	}

	acceptQuestionData(qd){
		this.history.push(qd);

		this.seedPerson      = qd.seedPerson;
		this.answersReturned = qd.answersReturned;
		this.nextAnswer      = qd.nextAnswer;
		this.linkingArticles = qd.linkingArticles;

		this.blacklistCandidate(this.seedPerson);
		this.blacklistCandidate(this.nextAnswer);
		debug(`Game.acceptQuestionData: seedPerson=${qd.seedPerson}, num remainingCandidatesWithConnections=${this.remainingCandidatesWithConnections.length}`);
	}
} // eof Class Game

function createANewGame(userUUID){

	if(userUUID === undefined){
		return Promise.reject('No user UUID was passed to the function');
	}

	const newGame = new Game(userUUID);
	debug(`createANewGame: newGame=${JSON.stringify(newGame)}`);

	return correlations_service.biggestIsland()
		.then(island => {	newGame.addCandidates(island) })
		.then( () => { return correlations_service.summary() } )
		.then( summary => {
			debug(`createANewGame: summary=${JSON.stringify(summary)}`);
			newGame.intervalDays = Math.floor( summary.times.intervalCoveredHrs / 24 )
		} )
		.then(function(){
			return database.write(newGame, process.env.GAME_TABLE)
				.then(function(){
					return newGame.uuid;
				})
				.catch(err => {
					debug('createANewGame: Unable to store game instance in database:', err);
					throw err;
				})
			;
		})
	;
}

function getAQuestionToAnswer(gameUUID){

	debug(`getAQuestionToAnswer: gameUUID=${gameUUID}`);

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
			debug(`getAQuestionToAnswer: selectedGame=${JSON.stringify(selectedGame)}`);

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
					options : selectedGame.answersReturned,
					intervalDays : selectedGame.intervalDays,
				});
			} else {
				// if we are here, we need to pick our seed, nextAnswer, answersReturned

				// selectedGame.clearQuestion();

				selectedGame.promiseNextCandidateQuestion()
				.then(questionData => {
					debug(`getAQuestionToAnswer: questionData=${JSON.stringify(questionData, null, 2)}`);

					if(questionData === undefined){
						// The game is out of connections between the remaining (if any) candidates
						debug(`getAQuestionToAnswer: Game ${selectedGame.uuid} has been won`);
						debug(`getAQuestionToAnswer: selectedGame.uuid=${selectedGame.uuid}, selectedGame=${selectedGame}`);

						selectedGame.state = 'finished';
						database.write(selectedGame, process.env.GAME_TABLE)
						.then(function(){
							debug(`getAQuestionToAnswer: Game state (${selectedGame.uuid}) successfully updated on completion.`);
							resolve({
								limitReached : true,
								score        : selectedGame.distance,
								history      : selectedGame.history,
							});
						})
						.catch(err => {
							debug(`getAQuestionToAnswer: Unable to save game state (${selectedGame.uuid}) at limit reached`, err);
							throw err;
						});
						;

					} else {
						selectedGame.acceptQuestionData( questionData );

						database.write(selectedGame, process.env.GAME_TABLE)
						.then(function(){
							debug(`getAQuestionToAnswer: Game state (${selectedGame.uuid}) successfully updated on generation of answers.`);
							resolve({
								seed         : selectedGame.seedPerson,
								options      : selectedGame.answersReturned,
								limitReached : false,
								intervalDays : selectedGame.intervalDays,
							});
						})
						.catch(err => {
							debug(`getAQuestionToAnswer: Unable to save game state whilst returning answers`, err);
							throw err;
						})
						;
					}
				})
				;
			}
		})
		;
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

				const result = {
					correct         : undefined,
					score           : selectedGame.distance,
					expected        : selectedGame.nextAnswer,
					linkingArticles : selectedGame.linkingArticles,
					seedPerson      : selectedGame.seedPerson,
					submittedAnswer : submittedAnswer,
					history         : selectedGame.history,
				};

				function normaliseName(name) { return name.replace('.', '').replace('-', ' ').toLowerCase(); }
				if(normaliseName(submittedAnswer) === normaliseName(selectedGame.nextAnswer)){

					selectedGame.distance += 1;
					selectedGame.clearQuestion();

					database.write(selectedGame, process.env.GAME_TABLE)
						.then(function(){
							result.correct = true;
							result.score   += 1;
							debug(`answerAQuestion: result=${JSON.stringify(result,null,2)}` );
							resolve(result);
						})
						.catch(err => {
							debug(`answerAQuestion: Unable to save game state (${selectedGame.uuid}) on correct answering of question`, err);
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
							result.correct = false;
							resolve(result);
						})
						.catch(err => {
							debug(`answerAQuestion: Unable to save game state (${selectedGame.uuid}) on incorrect answering of question`, err);
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

		debug(`getListOfHighScores: HIGH SCORES ${highScores}`);

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

	debug(`checkIfAGameExistsForAGivenUUID: Checking gameUUID ${gameUUID}`);

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
					debug(`checkIfAGameExistsForAGivenUUID: Unable to check if game (${gameUUID}) exists`, err);
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
			debug(`getGameDetails: Unable to read entry for game ${gameUUID}`, err);
			throw err;
		})
	;
}

function getStats(){
	return {
		correlations_service : correlations_service.stats(),
	}
}

module.exports = {
	new : createANewGame,
	question : getAQuestionToAnswer,
	answer : answerAQuestion,
	highScores : getListOfHighScores,
	check : checkIfAGameExistsForAGivenUUID,
	get : getGameDetails,
	stats : getStats,
};
