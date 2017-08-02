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
	app.ask('<speak>Test</speak>', ['fallback']);
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