const debug = require('debug')('correlations-game:routes:voice');
const express = require('express');
const router = express.Router();

const games = require('../bin/lib/game');
let expectedAnswers = [];

router.post('/googlehome', (req, res) => {
	const USER_INPUT = req.body.result.resolvedQuery;
	const SESSION = req.body.sessionId;
	let answer;

	res.setHeader('Content-Type', 'application/json');

	switch(USER_INPUT.toLowerCase()) {
		case 'start':
			return getQuestion(SESSION, ans => {
				res.send(JSON.stringify({'speech': ans, 'displayText': ans}));
			});
		break;

		case 'repeat':
			return getQuestion(SESSION, ans => {
				res.send(JSON.stringify({'speech': ans, 'displayText': ans}));
			});
		break;

		case 'help':
			//TODO: return instructions
		break;

		case expectedAnswers[0]:
		case expectedAnswers[1]:
		case expectedAnswers[2]:
			return checkAnswer(SESSION, 'people:' + USER_INPUT, ans => {
				res.send(JSON.stringify({'speech': ans, 'displayText': ans}));
			});
		break;

		default:
			answer = 'Sorry, I\'m not quite sure what you meant';
	}

	res.send(JSON.stringify({'speech': answer, 'displayText': answer}));

});

function getQuestion(session, callback) {
	games.check(session)
	.then(gameIsInProgress => {
		if(gameIsInProgress){
			console.log('PROGRESS');
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
			callback('winner');
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

			formatQuestion(preparedData, ans => {
				callback(ans);
			});
		}
	});
}

function checkAnswer(session, answer, callback) {
	games.answer(session, answer)
	.then(result => {
		if(result.correct === true){
			getQuestion(session, ans => {
				callback('Correct. ' + ans);
			});
		} else {
			expectedAnswers = [];
			callback('Sorry, that is incorrect.' + JSON.stringify(result));
			//TODO: add correct answer (reset game sessionid?);
		}
	});
}

function formatQuestion(options, callback) {
	let answerFormat = 'Who was recently mentioned in an article with ' + options.seed.printValue + '?\n';
	expectedAnswers = [];
	Object.keys(options.options).forEach(key => {
		answerFormat += ' - ' + options.options[key].printValue;
		expectedAnswers.push(options.options[key].printValue.toLowerCase());
	});

	callback(answerFormat);
}

module.exports = router;