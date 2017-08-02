'use strict';
const debug = require('debug')('correlations-game:routes:voice');
const express = require('express');
const router = express.Router();
const { ApiAiApp } = require('actions-on-google');

process.env.DEBUG = 'actions-on-google:*';

// const games = (process.env.GAME === 'LONGER') ? require('../bin/lib/gameLonger') : require('../bin/lib/game');
// const responses = require('../responses/content');
// const activeSessions = require('../bin/lib/active-sessions-interface');

const not_understood_limit = 3;

const Actions = {
  INIT: 		'correlations.welcome',
  QUESTION: 	'correlations.question',
  ANSWER:   	'correlations.answer'
};

if (!Object.values) {
  Object.values = o => Object.keys(o).map(k => o[k]);
}

const welcome = app => {
	app.ask('<speak>Welcome</speak>', 'fallback');
}

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

const actionMap = new Map();
actionMap.set(Actions.INIT, welcome);
actionMap.set(Actions.QUESTION, returnQuestion);
actionMap.set(Actions.ANSWER, matchAnswer);

router.post('/googlehome', (req, res) => {

	console.log('INIT::', req);

	res.json('<speak>Testy</speak>');
	// const app = new ApiAiApp({ req, res });
	// console.log('INIT1::', app);
 //  	app.handleRequest(actionMap);
});

module.exports = router;
