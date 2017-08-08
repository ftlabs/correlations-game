'use strict';
const debug = require('debug')('correlations-game:routes:voice');
const express = require('express');
const router = express.Router();
const games = require('../bin/lib/game');
const responses = require('../responses/content');
const { ApiAiApp } = require('actions-on-google');

process.env.DEBUG = 'actions-on-google:*';

const Actions = {
  INIT: 		'correlations.welcome',
  QUESTION: 	'correlations.question',
  ANSWER:   	'correlations.answer',
  NOTHEARD:  	'correlations.misunderstood'
};

const Contexts = {
	GAME: 	'Game',
	MISUNDERSTOOD: 'Misunderstood'
};

const optionsSynonyms = [
	[
		'1',
		'one',
		'won',
		'huan',
		'juan'
	],

	[
		'2',
		'two',
		'to',
		'too'
	],

	[
		'3',
		'three',
		'tree'
	]
]

if (!Object.values) {
  Object.values = o => Object.keys(o).map(k => o[k]);
}

const returnQuestion = app => {
	app.setContext(Contexts.GAME, 1000);
	getQuestion(app.body_.sessionId, obj => {
		let richResponse;
    	if(app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT)) {
    		richResponse = app.buildRichResponse()
				.addSimpleResponse(obj.displayText)
				.addSuggestions(['1', '2', '3']);
    	} else {
    		richResponse = app.buildRichResponse()
				.addSimpleResponse(obj.ssml);
    	}
    	
		app.ask(richResponse);
	});
};

const matchAnswer = app => {
	let USER_INPUT = app.body_.result.resolvedQuery;
	const SESSION = app.body_.sessionId;

	getExpectedAnswers(SESSION)
	.then(answers => {
		const expectedAnswers = Object.keys(answers).map(key => {
			answers[key] = {original: answers[key].replace('people:', ''), match: answers[key].replace('people:', '').replace('.', '').replace('-', ' ').toLowerCase()}
			return answers[key];
		});

		if (checkString(USER_INPUT.toLowerCase(), 0)) {
			USER_INPUT = expectedAnswers[0].match;
		} else if (checkString(USER_INPUT.toLowerCase(), 1)) {
			USER_INPUT = expectedAnswers[1].match;
		} else if (checkString(USER_INPUT.toLowerCase(), 2)) {
			USER_INPUT = expectedAnswers[2].match;
		}

		if (
			USER_INPUT.toLowerCase() === expectedAnswers[0].match ||
			USER_INPUT.toLowerCase() === expectedAnswers[1].match ||
			USER_INPUT.toLowerCase() === expectedAnswers[2].match
		) {
			checkAnswer(SESSION, 'people:' + USER_INPUT, (obj, addSuggestions) => {
    			app.setContext(Contexts.GAME, 1000);

    			let richResponse;
    			if(app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT)) {
    				if(addSuggestions) {
    					richResponse = app.buildRichResponse()
	    					.addSimpleResponse({speech: obj.speech, displayText:obj.displayText, ssml: obj.ssml})
	    					.addBasicCard(app.buildBasicCard(obj.article)
						      .setTitle(obj.article)
						      .addButton('Read article', obj.link)
						    )
						    .addSimpleResponse({speech: obj.question.displayText, displayText: obj.question.displayText, ssml: obj.question.ssml})
	    					.addSuggestions(obj.chips);
    				} else {
    					richResponse = app.buildRichResponse()
    						.addSimpleResponse({speech: obj.speech, displayText:obj.displayText, ssml: obj.ssml})
    						.addBasicCard(app.buildBasicCard(obj.article)
						      .setTitle(obj.article)
						      .addButton('Read article', obj.link)
						    )
						    .addSimpleResponse(obj.score);
    				}
    			} else {
					richResponse = app.buildRichResponse()
						.addSimpleResponse(obj.ssml);

					if(addSuggestions) {
						richResponse.addSimpleResponse(obj.question.ssml);
					} else {
						richResponse.addSimpleResponse(obj.score);
					}
    			}

    			app.ask(richResponse)
			});
		} else {
			let response = responses.misunderstood(true, USER_INPUT, expectedAnswers);
			if(app.getContext(Contexts.MISUNDERSTOOD.toLowerCase()) === null && expectedAnswers.length > 0) {
				app.setContext(Contexts.MISUNDERSTOOD, 3);
				return app.ask({speech: response.speech, displayText: response.displayText, ssml: response.ssml});
			}

			if(app.getContext(Contexts.MISUNDERSTOOD.toLowerCase()).lifespan === 0 || expectedAnswers.length === 0) {
				if(expectedAnswers.length === 0) {
					app.setContext(Contexts.MISUNDERSTOOD, 1);
				}
				
				response = responses.misunderstood(false);
				return app.ask({speech: response.speech, displayText: response.displayText, ssml: response.ssml});
			}

			app.ask({speech: response.speech, displayText: response.displayText, ssml: response.ssml});
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
			callback(responses.win({score: data.score}));
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
	})
	.catch(err => {
		debug('HANDLED REJECTION', err);
	})
	;
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
					callback(responses.correctAnswer(result.linkingArticles[0], obj), true);
				});
			} else {
				callback(responses.incorrectAnswer(result.expected, result.linkingArticles[0], {score: result.score, scoreMax: result.globalHighestScore, first: result.achievedHighestScoreFirst}), false);
			}
		})
	;
}

function checkString(input, option) {
	for(let i = 0; i < optionsSynonyms[option].length; ++i) {
		if(input.startsWith(optionsSynonyms[option][i])) {
			return true;
		}
	}

	return false;
}

const actionMap = new Map();
actionMap.set(Actions.QUESTION, returnQuestion);
actionMap.set(Actions.ANSWER, matchAnswer);
actionMap.set(Actions.NOTHEARD, matchAnswer);

router.post('/googlehome', (request, response) => {
  const app = new ApiAiApp({ request, response });
  app.handleRequest(actionMap);
});

module.exports = router;
