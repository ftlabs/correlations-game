const debug = require('debug')('correlations-game:routes:voice');
const express = require('express');
const router = express.Router();
const { ApiAiApp } = require('actions-on-google');


const games = (process.env.GAME === 'LONGER') ? require('../bin/lib/gameLonger') : require('../bin/lib/game');
const responses = require('../responses/content');
const activeSessions = require('../bin/lib/active-sessions-interface');

const not_understood_limit = 3;

const Actions = {
  INIT: 		'correlations.welcome',
  QUESTION: 	'correlations.question',
  ANSWER:   	'correlations.answer'
};

const returnQuestion = app => {
	console.log('Getting question', app);
	// getQuestion(app.body_.sessionId, obj => {
	// 	app.ask(obj);
	// });
	app.ask('<speak> Is that you I see?</speak>', 'fallback');
};

const matchAnswer = app => {
	app.ask('<speak>Test</speak>');
};


// router.post('/googlehome', (req, res) => {
// 	let USER_INPUT = req.body.result.resolvedQuery;
// 	const SESSION = req.body.sessionId;

// 	setCountState(SESSION, null)
// 		.then(sessionCount => {

// 			let not_understood_count = sessionCount;

// 			getExpectedAnswers(SESSION)
// 				.then(answers => {
// 					const expectedAnswers = Object.keys(answers).map(key => {
// 						return answers[key].replace('people:', '').replace('.', '').replace('-', ' ').toLowerCase();
// 					});

// 					if(USER_INPUT.startsWith('1') || USER_INPUT.toLowerCase().startsWith('one')) {
// 						USER_INPUT = expectedAnswers[0];
// 					} else if(USER_INPUT.startsWith('2') || USER_INPUT.toLowerCase().startsWith('two')) {
// 						USER_INPUT = expectedAnswers[1];
// 					} else if(USER_INPUT.startsWith('3') || USER_INPUT.toLowerCase().startsWith('three')) {
// 						USER_INPUT = expectedAnswers[2];
// 					}

// 					switch(USER_INPUT.toLowerCase()) {
// 						case 'start':
// 						case 'repeat':
// 							debug(`start || repeat ${SESSION}`);
// 							setCountState(SESSION, 0);
// 							getQuestion(SESSION, obj => {
// 								res.json(obj);
// 							});
// 						break;

// 						case 'help':
// 							debug(`help ${SESSION}`);
// 							setCountState(SESSION, 0);
// 							answer = "Add instructions here";
// 							//?TODO: handle in a different intent?
// 						break;

// 						case expectedAnswers[0]:
// 						case expectedAnswers[1]:
// 						case expectedAnswers[2]:
// 							debug(`expectedAnswers ${SESSION}`);
// 							setCountState(SESSION, 0);
// 							checkAnswer(SESSION, 'people:' + USER_INPUT, obj => {
// 								debug(obj);
// 								res.json(obj);
// 							});

// 						break;

// 						default:

// 							debug(`default ${SESSION}`);
// 							let answer;

// 							if(not_understood_count < not_understood_limit && expectedAnswers.length > 0) {
// 								answer = responses.misunderstood(true, USER_INPUT, expectedAnswers);
// 								++not_understood_count;
// 								setCountState(SESSION, not_understood_count);
// 							} else {
// 								answer = responses.misunderstood(false);
// 							}

// 							res.json(answer);

// 							debug(answer);
// 					}
// 				})
// 			;
// 		})
// 		.catch(err => {
// 			debug('Unknown error', err);
// 			if(err === "GAMEOVER"){
// 				const winnerResponse = responses.win();
// 				debug(winnerResponse);
// 				res.json(winnerResponse);
// 			} else {
// 				const misunderstoodResponse = responses.misunderstood();
// 				res.json(misunderstoodResponse);
// 			}
// 		})
// 	;
// });

function getExpectedAnswers(session) {
	return games.check(session)
	.then(gameIsInProgress => {
		if(gameIsInProgress) {
			return games.get(session).then(data => data.answersReturned);
		} else {
			return [];
		}
	});
}

function getQuestion(session, callback) {
	games.check(session)
	.then(gameIsInProgress => {
		if(gameIsInProgress){
			return games.question(session);
		} else {
			return games.new(session)
			.then(gameUUID => {
				return gameUUID;
			})
			.then(gameUUID => games.question(gameUUID))
			;
		}
	})
	.then(data => {
		if(data.limitReached === true){
			callback(responses.win());
		} else {
			const preparedData = {};

			preparedData.seed = {
				value : data.seed,
				printValue : data.seed.replace('people:', '').replace('.', '').replace('-', ' ')
			};

			preparedData.options = {};

			Object.keys(data.options).forEach(key => {
				preparedData.options[key] = {
					value : data.options[key],
					printValue : data.options[key].replace('people:', '').replace('.', '').replace('-', ' ')
				};
			});

			callback(responses.askQuestion(preparedData));
		}
	});
}

function checkAnswer(session, answer, callback) {
	games.answer(session, answer)
		.then(result => {
			if(result.correct === true){
				getQuestion(session, obj => {
					callback(responses.correctAnswer(result.linkingArticles[0].title, obj));
				});
			} else {
				callback(responses.incorrectAnswer(result.expected, result.linkingArticles[0].title));
			}
		})
	;
}

function setCountState(sessionID, count) {

	return activeSessions.get(sessionID)
		.then(session => {

			if(session === undefined) {
				session = {};
				session.id = sessionID;
			}

			if(session === undefined){
				session.count = 0;
			} else {
				session.count = count === null ? session.count : count;
			}

			return activeSessions.set(session)
				.then(function(){
					return session.count;
				})
			;

		})
		.catch(err => {
			debug(err);
		})
	;
}


const actionMap = new Map();
// actionMap.set(Actions.INIT, functionNameHere);
actionMap.set(Actions.QUESTION, returnQuestion);
actionMap.set(Actions.ANSWER, matchAnswer);

router.post('/googlehome', (req, res) => {

	console.log('INIT::');
	const app = new ApiAiApp({ req, res });
	console.log('INIT1::', app);
  	app.handleRequest(actionMap);
});

module.exports = router;
