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

	// games.check(SESSION)
	// .then(gameIsInProgress => {
	// 	if(gameIsInProgress){
	// 		console.log('PROGRESS');
	// 		return games.question(SESSION);
	// 	} else {
	// 		return games.new(SESSION)
	// 			.then(gameUUID => {
	// 				return gameUUID;
	// 			})
	// 			.then(gameUUID => games.question(gameUUID))
	// 		;
	// 	}
	// })
	// .then(data => {
	// 	if(data.limitReached === true){
	// 		answer = 'winner';
	// 		res.send(JSON.stringify({'speech': answer, 'displayText': answer}));
	// 	} else {
	// 		const preparedData = {};

	// 		preparedData.seed = {
	// 			value : data.seed,
	// 			printValue : data.seed.replace('people:', '')
	// 		};

	// 		preparedData.options = {};

	// 		Object.keys(data.options).forEach(key => {
	// 			preparedData.options[key] = {
	// 				value : data.options[key],
	// 				printValue : data.options[key].replace('people:', '')
	// 			};
	// 		});

	// 		formatQuestion(preparedData, ans => {
	// 			res.send(JSON.stringify({'speech': ans, 'displayText': ans}));
	// 		});
	// 	}

	// });

	switch(USER_INPUT.toLowerCase()) {
		case 'start':
			return startGame(SESSION, ans => {
				res.send(JSON.stringify({'speech': 'start' + ans, 'displayText': ans}));
			})
			// return getQuestion(USER_INPUT, ans => {
			// 	res.send(JSON.stringify({'speech': ans, 'displayText': ans}));
			// });
		break;

		case expectedAnswers[0]:
		case expectedAnswers[1]:
		case expectedAnswers[2]:
			answer = 'You said' + USER_INPUT;
		break;

		default:
			answer = 'Sorry I didn\'t quite catch that...'
	}

	res.send(JSON.stringify({'speech': answer, 'displayText': answer}));

});

function startGame(session, callback) {
	games.check(SESSION)
	.then(gameIsInProgress => {
		if(gameIsInProgress){
			console.log('PROGRESS');
			return games.question(SESSION);
		} else {
			return games.new(SESSION)
				.then(gameUUID => {
					return gameUUID;
				})
				.then(gameUUID => games.question(gameUUID))
			;
		}
	})
	.then(data => {
		if(data.limitReached === true){
			answer = 'winner';
			// res.send(JSON.stringify({'speech': answer, 'displayText': answer}));
			callback(answer);
		} else {
			const preparedData = {};

			preparedData.seed = {
				value : data.seed,
				printValue : data.seed.replace('people:', '')
			};

			preparedData.options = {};

			Object.keys(data.options).forEach(key => {
				preparedData.options[key] = {
					value : data.options[key],
					printValue : data.options[key].replace('people:', '')
				};
			});

			formatQuestion(preparedData, ans => {
				// res.send(JSON.stringify({'speech': ans, 'displayText': ans}));
				callback(ans);
			});
		}
	});
}

function formatQuestion(options, callback) {
	let answerFormat = 'Who was recently mentioned in an article with ' + options.seed.printValue + '?\n';
	expectedAnswers = [];
	Object.keys(options.options).forEach(key => {
		answerFormat += ' - ' + options.options[key].printValue;
		expectedAnswers.push(options.options[key].printValue);
	});

	callback(answerFormat);
}

module.exports = router;