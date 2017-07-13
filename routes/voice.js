const debug = require('debug')('correlations-game:routes:voice');
const express = require('express');
const router = express.Router();

const games = require('../bin/lib/game');

router.post('/googlehome', (req, res) => {
	const USER_INPUT = req.body.result.resolvedQuery;
	const SESSION = req.body.sessionId;
	let answer;

	res.setHeader('Content-Type', 'application/json');
	console.log(req.body);

	const resolve = res;

	games.check(SESSION)
	.then(gameIsInProgress => {
		if(gameIsInProgress){
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
			resolve.send(JSON.stringify({'speech': answer, 'displayText': answer}));
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

			answer = preparedData;
			formatQuestion(answer, ans => {
				resolve.send(JSON.stringify({'speech': ans, 'displayText': ans}));
			})
		}

	});

	// switch(USER_INPUT.toLowerCase()) {
	// 	case 'start':
	// 		return getQuestion(USER_INPUT, ans => {
	// 			res.send(JSON.stringify({'speech': ans, 'displayText': ans}));
	// 		});
	// 	break;

	// 	default:
	// 		answer = 'Sorry I didn\'t quite catch that...'
	// }

	

});

function formatQuestion(options, callback) {
	let answerFormat = 'Who was recently mentioned in an article with ' + options.seed.printValue + '?\n';
	console.log(JSON.stringify(options));
	for(let i = 0; i < options.options.length; ++i) {
		answerFormat += options.options[i].printValue + '\n';
	}

	callback(answerFormat);
}

module.exports = router;