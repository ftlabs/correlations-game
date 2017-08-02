'use strict';
const debug = require('debug')('correlations-game:routes:voice');
const express = require('express');
const router = express.Router();
const games = (process.env.GAME === 'LONGER') ? require('../bin/lib/gameLonger') : require('../bin/lib/game');
const responses = require('../responses/content');
const { ApiAiApp } = require('actions-on-google');

process.env.DEBUG = 'actions-on-google:*';

const Actions = {
  INIT: 		'correlations.welcome',
  QUESTION: 	'correlations.question',
  ANSWER:   	'correlations.answer' 
};

if (!Object.values) {
  Object.values = o => Object.keys(o).map(k => o[k]);
}

const returnQuestion = app => {
	console.log('Getting question', app);
	getQuestion(app.body_.sessionId, obj => {
		app.ask(obj.ssml, ['fallback']);
	});
};

const matchAnswer = app => {
	let USER_INPUT = app.body_.result.resolvedQuery;
	const SESSION = app.body_.sessionId;

	console.log('MATCH:::', USER_INPUT, SESSION);

	getExpectedAnswers(SESSION)
	.then(answers => {
		const expectedAnswers = Object.keys(answers).map(key => {
			return answers[key].replace('people:', '').replace('.', '').replace('-', ' ').toLowerCase();
		});

		if (USER_INPUT.startsWith('1') || USER_INPUT.toLowerCase().startsWith('one')) {
			USER_INPUT = expectedAnswers[0];
		} else if (USER_INPUT.startsWith('2') || USER_INPUT.toLowerCase().startsWith('two')) {
			USER_INPUT = expectedAnswers[1];
		} else if (USER_INPUT.startsWith('3') || USER_INPUT.toLowerCase().startsWith('three')) {
			USER_INPUT = expectedAnswers[2];
		}

		if (
			USER_INPUT === expectedAnswers[0] ||
			USER_INPUT === expectedAnswers[1] ||
			USER_INPUT === expectedAnswers[2]
		) {
			checkAnswer(SESSION, 'people:' + USER_INPUT, obj => {
				app.ask(obj.ssml, ['fallback']);
			});
		}
	});

	
};

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

const actionMap = new Map();
// actionMap.set(Actions.INIT, testFunction);
actionMap.set(Actions.QUESTION, returnQuestion);
actionMap.set(Actions.ANSWER, matchAnswer);

router.post('/googlehome', (request, response) => {
  const app = new ApiAiApp({ request, response });
  // console.log(`Request headers: ${JSON.stringify(request.headers)}`);
  // console.log(`Request body: ${JSON.stringify(request.body)}`);
  app.handleRequest(actionMap);
});

module.exports = router;