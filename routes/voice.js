'use strict';
const debug = require('debug')('correlations-game:routes:voice');
const express = require('express');
const router = express.Router();

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
	// getQuestion(app.body_.sessionId, obj => {
	// 	app.ask(obj);
	// });
	app.ask('<speak> Is that you I see?</speak>', ['fallback']);
};

const matchAnswer = app => {
	app.ask('<speak>Test</speak>', ['fallback']);
};

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