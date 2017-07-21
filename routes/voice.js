const debug = require('debug')('correlations-game:routes:voice');
const express = require('express');
const router = express.Router();

const games = require('../bin/lib/game');
const activeSessions = {};
const not_understood_limit = 3;

router.post('/googlehome', (req, res) => {
	let USER_INPUT = req.body.result.resolvedQuery;
	const SESSION = req.body.sessionId;
	let answer;
	setCountState(SESSION, null);

	let not_understood_count = activeSessions[SESSION].count;


	checkExpectedInput(SESSION)
		.then(answers => {
			const expectedAnswers = Object.keys(answers).map(key => {
				return answers[key].replace('people:', '').replace('.', '').replace('-', ' ').toLowerCase();
			});

			if(USER_INPUT.startsWith('1') || USER_INPUT.toLowerCase().startsWith('one')) {
				USER_INPUT = expectedAnswers[0];
			} else if(USER_INPUT.startsWith('2') || USER_INPUT.toLowerCase().startsWith('two')) {
				USER_INPUT = expectedAnswers[1];
			} else if(USER_INPUT.startsWith('3') || USER_INPUT.toLowerCase().startsWith('three')) {
				USER_INPUT = expectedAnswers[2];
			}

			switch(USER_INPUT.toLowerCase()) {
				case 'start':
				case 'repeat':
					setCountState(SESSION, 0);
					return getQuestion(SESSION, ans => {
						res.json({'speech': ans, 'displayText': ans});
					});
				break;

				case 'help':
					setCountState(SESSION, 0);
					answer = "Add instructions here";
					//?TODO: handle in a different intent?
				break;

				case expectedAnswers[0]:
				case expectedAnswers[1]:
				case expectedAnswers[2]:
					setCountState(SESSION, 0);
					return checkAnswer(SESSION, 'people:' + USER_INPUT, ans => {
						res.json({'speech': ans, 'displayText': ans});
					});
				break;

				default:
					if(not_understood_count < not_understood_limit && expectedAnswers.length > 0) {
						answer = 'Sorry, I heard '+ USER_INPUT +'. The possible answers were:';

						for(let i = 0; i < expectedAnswers.length; ++i) {
							answer += (i + 1) + ') ' + expectedAnswers[i] + ' ';
						}

						++not_understood_count;
						setCountState(SESSION, not_understood_count);
					} else {
						answer = 'Sorry, I\'m not quite sure what you mean. Say "help" for instructions.';
					}
			}
			
			res.json({'speech': answer, 'displayText': answer});

		});

});

function checkExpectedInput(session) {
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
			callback('Sorry, that is incorrect. The correct answer was ' + result.expected);
		}
	});
}

function formatQuestion(options, callback) {
	let answerFormat = 'Who was recently mentioned in an article with ' + options.seed.printValue + '?\n';

	Object.keys(options.options).forEach((key, index) => {
		answerFormat += (index + 1) + ') ' + options.options[key].printValue + ' ';
		++answerCount;
	});

	callback(answerFormat);
}

function setCountState(sessionID, count) {
	if(activeSessions[sessionID] === undefined) {
		activeSessions[sessionID] = {};
	}

	return new Promise( (resolve) => {
		const activeSession = activeSessions[sessionID]
		if(activeSession.count === undefined){
			activeSession.count = 0;
		} else {
			activeSession.count = (count === null)?activeSession.count:count;
		}

		resolve({
			count : activeSession.count
		});

	});
}

module.exports = router;
