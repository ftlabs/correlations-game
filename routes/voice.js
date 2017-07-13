const debug = require('debug')('correlations-game:routes:voice');
const express = require('express');
const router = express.Router();

const games = require('../bin/lib/game');

router.post('/googlehome', (req, res) => {
	const USER_INPUT = req.body.result.resolvedQuery;
	let answer;

	res.setHeader('Content-Type', 'application/json');

	switch(USER_INPUT.toLowerCase()) {
		case 'start':
			return getQuestion(USER_INPUT, ans => {
				res.send(JSON.stringify({'speech': ans, 'displayText': ans}));
			});
		break;

		default:
			answer = 'Sorry I didn\'t quite catch that...'
	}

	res.send(JSON.stringify({'speech': answer, 'displayText': answer}));

});

function getQuestion(text, callback) {
	callback('You said ' + text);
}

module.exports = router;