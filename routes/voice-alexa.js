'use strict';
const debug = require('debug')('correlations-game:routes:voice');
const express = require('express');
const router = express.Router();
const games = require('../bin/lib/game');
const responses = require('../responses/content');
const Alexa = require('alexa-sdk');
const striptags = require('striptags');
const TextUtils = Alexa.utils.TextUtils;
const ImageUtils = Alexa.utils.ImageUtils;
const IS_TEST_MODE = checkTestMode();

function checkTestMode() {
	if (process.env.hasOwnProperty('TEST_MODE')) {
		if (process.env.TEST_MODE == 'true') {
			return true;
		}
	}
	return false;
}

//Must be set to the App ID of the Alexa skills within the AWS dashboard
const APP_ID = process.env.APP_ID;

const spoor = require('../bin/lib/log-to-spoor');

const GAME_STATES = {
	START: '_STARTMODE',
	QUIZ: '_QUIZMODE',
	HELP: '_HELPMODE'
};

const speech = {
	WELCOME:
		'Welcome to Make Connections, an FT Labs game. For instructions, say "help". Shall we start playing?',
	ENDGAME: 'Thank you for playing. There are new connections every day.',
	UNHANDLED: `Sorry, I did not understand that. For instructions, say "Help".`,
	START_UNHANDLED: `Sorry, I did not understand that. Say "yes" to start a new game. For instructions, say "Help".`,
	QUIZ_UNHANDLED: `Sorry, I did not understand that. Try selecting numbers instead of names. For instructions, say "Help".`,
	HELP_UNHANDLED: `Sorry, I did not understand that. Say "yes" to return to an active game. For instructions, say "Help".`,
	ASK_CONTINUE: 'I have paused the game, would you like to continue playing?',
	ASK_NEW_GAME: 'Would you like to start a new game?'
};

const newSessionHandlers = {
	LaunchRequest: function() {
		this.handler.state = GAME_STATES.START;
		this.emitWithState('WelcomeGame', true);
	},
	StartGame: function() {
		this.handler.state = GAME_STATES.START;
		this.emitWithState('StartGame', true);
	},
	'AMAZON.StartOverIntent': function() {
		this.handler.state = GAME_STATES.START;
		this.emitWithState('WelcomeGame', true);
	},
	'AMAZON.HelpIntent': function() {
		this.handler.state = GAME_STATES.HELP;
		this.emitWithState('helpTheUser', true);
	},
	Unhandled: function() {
		this.response.speak(speech['UNHANDLED']).listen(speech['UNHANDLED']);
		this.emit(':responseReady');
	}
};

const startStateHandlers = Alexa.CreateStateHandler(GAME_STATES.START, {
	WelcomeGame: function() {
		this.emit(':ask', speech['WELCOME']);
	},
	'AMAZON.YesIntent': function() {
		this.emit('StartGame');
	},
	'AMAZON.StartOverIntent': function() {
		this.emit('StartGame');
	},
	'AMAZON.NoIntent': function() {
		this.response.speak(speech['ENDGAME']);
		const cardTitle = 'Goodbye';
		const cardBody = speech['ENDGAME'];
		this.response.cardRenderer(cardTitle, cardBody);
		this.emit(':responseReady');
	},
	'AMAZON.CancelIntent': function() {
		this.emit(':tell', speech['ENDGAME']);
	},
	'AMAZON.HelpIntent': function() {
		this.handler.state = GAME_STATES.HELP;
		this.emitWithState('helpTheUser', true);
	},
	'AMAZON.StopIntent': function() {
		this.response.speak(speech['ENDGAME']);
		const cardTitle = 'Goodbye';
		const cardBody = speech['ENDGAME'];
		this.response.cardRenderer(cardTitle, cardBody);
		this.emit(':responseReady');
	},
	StartGame: function() {
		this.handler.state = GAME_STATES.QUIZ;
		this.emitWithState('QuestionIntent');
	},
	Unhandled: function() {
		this.response
			.speak(speech['START_UNHANDLED'])
			.listen(speech['START_UNHANDLED']);
		this.emit(':responseReady');
	},
	ElementSelected: function() {
		if (this.event.request.token == 'new_game') {
			this.emitWithState('StartGame');
			return;
		} else if (this.event.request.token == 'exit_game') {
			this.handler.state = GAME_STATES.QUIZ;
			this.emitWithState('AMAZON.CancelIntent');
		}
	}
});

const quizStateHandlers = Alexa.CreateStateHandler(GAME_STATES.QUIZ, {
	ElementSelected: function() {
		this.emitWithState('AnswerIntent');
	},

	QuestionIntent: function() {
		const sessionId = this.event.session.sessionId;
		getQuestion(sessionId, question => {
			const questionSpeech = question.ssml;
			const questionItems = question.chips;
			const questionText = question.questionText;
			this.handler.state = GAME_STATES.QUIZ;
			let responseTemplate;

			//Simple Card content
			const cardTitle = `Question 1:`;
			const cardBody = convertQuestionSpeechToCardText(questionSpeech);
			this.response.cardRenderer(cardTitle, cardBody);
			//End Simple Card

			if (supportsDisplay.call(this) || isSimulator.call(this)) {
				const listTemplate = createQuestionTemplate(
					cardTitle,
					questionText,
					questionItems
				);
				this.response.renderTemplate(listTemplate);
				responseTemplate = listTemplate;
			}

			Object.assign(this.attributes, {
				speechOutput: questionSpeech,
				currentQuestion: 1,
				responseTemplate: responseTemplate
			});

			//Template Content (Echo show)
			this.response.speak(questionSpeech).listen(questionSpeech);
			this.emit(':responseReady');
		});
	},

	AnswerIntent: function() {
		const isSlot =
			this.event.request &&
			this.event.request.intent &&
			this.event.request.intent.slots;

		const isToken = this.event.request && this.event.request.token;
		let answerValue;

		if (isSlot) {
			answerValue = this.event.request.intent.slots.Answer.value;
			console.log('+++++++++++isSlot answerValue', answerValue);
		}
		if (isToken) {
			answerValue = this.event.request.token;
			console.log('+++++++++++isToken answerValue', answerValue);
		}
		if (typeof answerValue !== 'undefined') {
			const sessionId = this.event.session.sessionId;
			const guessValue = answerValue;
			const currentQuestion = this.attributes['currentQuestion'];

			checkGuess.call(
				this,
				sessionId,
				guessValue,
				currentQuestion,
				(response, reprompt, state, card, increment, responseTemplate) => {
					if (card && card.image) {
						card.image = card.image.replace('http', 'https');
						const imgUrl = `https://www.ft.com/__origami/service/image/v2/images/raw/${encodeURIComponent(
							card.image
						)}?source=ftlabs`;
						var imageObj = {
							smallImageUrl: imgUrl + '&width=720',
							largeImageUrl: imgUrl + '&width=1200'
						};
						this.response.cardRenderer(card.title, card.body, imageObj);
					}

					Object.assign(this.attributes, {
						speechOutput: reprompt,
						responseTemplate: responseTemplate
					});
					if (increment) {
						Object.assign(this.attributes, {
							currentQuestion: this.attributes['currentQuestion'] + 1
						});
					}
					this.handler.state = state;
					if (supportsDisplay.call(this) || isSimulator.call(this)) {
						if (responseTemplate) {
							this.response.renderTemplate(responseTemplate);
						}
					}
					this.response.speak(response).listen(reprompt);
					this.emit(':responseReady');
				}
			);
		} else {
			this.handler.state = GAME_STATES.QUIZ;
			this.emitWithState('Unhandled', true);
		}
	},
	'AMAZON.RepeatIntent': function() {
		this.response
			.speak(this.attributes['speechOutput'])
			.listen(this.attributes['speechOutput']);
		const responseTemplate = this.attributes['responseTemplate'];
		const cardTitle = `Question ${this.attributes.currentQuestion} Repeated`;
		const cardBody = convertQuestionSpeechToCardText(
			this.attributes['speechOutput']
		);
		if (supportsDisplay.call(this) || isSimulator.call(this)) {
			if (responseTemplate) {
				this.response.renderTemplate(responseTemplate);
			}
		}
		this.response.cardRenderer(cardTitle, cardBody);
		this.emit(':responseReady');
	},
	'AMAZON.HelpIntent': function() {
		this.handler.state = GAME_STATES.HELP;
		this.emitWithState('helpTheUser', true);
	},
	'AMAZON.CancelIntent': closeTheApp,
	'AMAZON.NoIntent': closeTheApp,
	'AMAZON.StartOverIntent': function() {
		const sessionId = this.event.session.sessionId;

		this.handler.state = GAME_STATES.START;
		games.interrupt(sessionId).then(data => {
			this.emitWithState('StartGame', true);
		});
	},
	'AMAZON.StopIntent': function() {
		this.handler.state = GAME_STATES.HELP;
		this.response.speak(speech['ASK_CONTINUE']).listen(speech['ASK_CONTINUE']);
		const cardTitle = 'Paused';
		this.response.cardRenderer(cardTitle, speech['ASK_CONTINUE']);
		this.emit(':responseReady');
	},
	Unhandled: function() {
		this.response
			.speak(speech['QUIZ_UNHANDLED'])
			.listen(speech['QUIZ_UNHANDLED']);
		if (supportsDisplay.call(this) || isSimulator.call(this)) {
			this.response.renderTemplate(this.attributes.responseTemplate);
		}
		this.emit(':responseReady');
	}
});

const helpStateHandlers = Alexa.CreateStateHandler(GAME_STATES.HELP, {
	ElementSelected: function() {
		if (this.event.request.token == 'exit_help') {
			this.emitWithState('AMAZON.YesIntent');
		}
	},

	'AMAZON.RepeatIntent': function() {
		this.emitWithState('helpTheUser', true);
	},

	helpTheUser: function() {
		const sessionId = this.event.session.sessionId;

		const helpBody = games.check(sessionId).then(gameIsInProgress => {
			let helpResponse = responses.help(gameIsInProgress).ssml;
			helpResponse = removeSpeakTags(helpResponse);

			const cardTitle = 'Help';
			let cardBody = responses.help(gameIsInProgress).displayText;
			this.response.cardRenderer(cardTitle, cardBody);

			if (gameIsInProgress) {
				cardBody = cardBody.replace(
					'continue your game?',
					"<action value='exit_help'>continue your game?</action>"
				);
				this.response.speak(helpResponse).listen(speech['ASK_CONTINUE']);
			} else {
				cardBody = cardBody.replace(
					'play now?',
					"<action value='exit_help'>play now?</action>"
				);
				this.response.speak(helpResponse).listen(speech['ASK_NEW_GAME']);
				this.attributes['speechOutput'] = null;
			}

			if (supportsDisplay.call(this) || isSimulator.call(this)) {
				const template = createHelpTemplate(cardTitle, cardBody);
				this.response.renderTemplate(template);
			}

			spoor({
				category: 'GAME',
				action: 'useraskedforhelp',
				system: {
					source: 'ftlabs-correlations-game',
					route: 'alexa'
				},
				context: {
					product: 'ftlabs',
					sessionId: sessionId
				}
			});

			console.log(
				`INFO: route=alexa; action=useraskedforhelp; sessionId=${sessionId};`
			);
			this.emit(':responseReady');
		});
	},
	'AMAZON.YesIntent': function() {
		if (this.attributes['speechOutput']) {
			this.handler.state = GAME_STATES.QUIZ;
			this.emitWithState('AMAZON.RepeatIntent');
		} else {
			this.handler.state = GAME_STATES.START;
			this.emitWithState('StartGame', true);
		}
	},
	'AMAZON.CancelIntent': function() {
		this.emit('AMAZON.NoIntent');
	},
	'AMAZON.NoIntent': function() {
		const sessionId = this.event.session.sessionId;

		games.check(sessionId).then(gameIsInProgress => {
			if (gameIsInProgress) {
				games.interrupt(sessionId).then(data => {
					const response = responses.stop(true, {
						score: data.score,
						scoreMax: data.globalHighestScore,
						first: data.achievedHighestScoreFirst
					});

					spoor({
						category: 'GAME',
						action: 'gameinterrupted',
						system: {
							source: 'ftlabs-correlations-game',
							route: 'alexa'
						},
						context: {
							product: 'ftlabs',
							sessionId: sessionId,
							latestScore: data.score,
							globalHighestScore: data.globalHighestScore,
							achievedHighestScoreFirst: data.achievedHighestScoreFirst
						}
					});

					console.log(
						`INFO: route=alexa; action=gameinterrupted; sessionId=${sessionId}; latestScore=${
							data.score
						}; globalHighestScore=${
							data.globalHighestScore
						}; achievedHighestScoreFirst=${data.achievedHighestScoreFirst}`
					);
					this.response.speak(response.speech);
					const cardTitle = 'Goodbye';
					const cardBody = removeSpeakTags(response.speech);
					this.response.cardRenderer(cardTitle, cardBody);

					this.emit(':responseReady');
				});
			} else {
				console.log(
					`INFO: route=alexa; action=gameinterrupted; sessionId=${sessionId}`
				);
				this.response.speak(speech['ENDGAME']);
				const cardTitle = 'Goodbye';
				const cardBody = speech['ENDGAME'];
				this.response.cardRenderer(cardTitle, cardBody);
				this.emit(':responseReady');
			}
		});
	},
	Unhandled: function() {
		this.response
			.speak(speech['HELP_UNHANDLED'])
			.listen(speech['HELP_UNHANDLED']);
		this.emit(':responseReady');
	}
});

function closeTheApp() {
	const sessionId = this.event.session.sessionId;

	games.interrupt(sessionId).then(data => {
		const response = responses.stop(true, {
			score: data.score,
			scoreMax: data.globalHighestScore,
			first: data.achievedHighestScoreFirst
		});
		this.response.speak(response.speech);
		const cardTitle = 'Goodbye';
		const cardBody = removeSpeakTags(response.speech);
		this.response.cardRenderer(cardTitle, cardBody);
		this.emit(':responseReady');
	});
}

function getQuestion(session, callback) {
	games
		.check(session)
		.then(gameIsInProgress => {
			if (gameIsInProgress) {
				spoor({
					category: 'GAME',
					action: 'questionasked',
					system: {
						source: 'ftlabs-correlations-game',
						route: 'alexa'
					},
					context: {
						product: 'ftlabs',
						sessionId: session
					}
				});

				console.log(
					`INFO: route=alexa; action=questionasked; sessionId=${session};`
				);
				return games.question(session);
			} else {
				spoor({
					category: 'GAME',
					action: 'gamestarted',
					system: {
						source: 'ftlabs-correlations-game',
						route: 'alexa'
					},
					context: {
						product: 'ftlabs',
						sessionId: session
					}
				});

				console.log(
					`INFO: route=alexa; action=gamestarted; sessionId=${session};`
				);
				return games
					.new(session)
					.then(gameUUID => {
						return gameUUID;
					})
					.then(gameUUID => games.question(gameUUID));
			}
		})
		.then(data => {
			if (data.limitReached === true) {
				// Connection limit met
				spoor({
					category: 'GAME',
					action: 'gamewon',
					system: {
						source: 'ftlabs-correlations-game',
						route: 'alexa'
					},
					context: {
						product: 'ftlabs',
						sessionId: session,
						score: data.score
					}
				});

				console.log(
					`INFO: route=alexa; action=gamewon; sessionId=${session}; score=${
						data.score
					}`
				);
				callback(responses.win({ score: data.score }));
			} else {
				const preparedData = {};

				preparedData.seed = {
					value: data.seed,
					printValue: data.seed
						.replace('people:', '')
						.replace('.', '')
						.replace('-', ' ')
				};

				preparedData.options = {};

				Object.keys(data.options).forEach(key => {
					preparedData.options[key] = {
						value: data.options[key],
						printValue: data.options[key]
							.replace('people:', '')
							.replace('.', '')
							.replace('-', ' ')
					};
				});

				let question = responses.askQuestion(preparedData, data.questionNum);
				question.ssml = removeSpeakTags(question.ssml);

				callback(question);
			}
		})
		.catch(err => {
			console.log('HANDLED REJECTION', err);
		});
}

function checkGuess(sessionId, guessValue, currentQuestion, callback) {
	let guess = guessValue;
	console.log('++++++++++++++++++guess', guess);
	getExpectedAnswers(sessionId).then(data => {
		const answers = data.answersReturned;
		const seed = data.seedPerson;

		let expectedAnswers;
		if (typeof answers[0] === 'string' || answers[0] instanceof String) {
			expectedAnswers = Object.keys(answers).map(key => {
				answers[key] = {
					original: answers[key].replace('people:', ''),
					match: answers[key]
						.replace('people:', '')
						.replace('.', '')
						.replace('-', ' ')
						.toLowerCase()
				};
				return answers[key];
			});
		} else {
			expectedAnswers = answers;
		}

		if (
			(parseInt(guessValue) >= 0 && parseInt(guessValue) <= 3) ||
			guessIsInAnswerList(guess, expectedAnswers)
		) {
			// Answer recognised
			if (parseInt(guessValue) >= 0 && parseInt(guessValue) <= 3) {
				// Get answer from index
				guess = expectedAnswers[parseInt(guess) - 1].original;
			} else {
				guess = matchAndGetOriginalAnswer(guess, expectedAnswers);
			}

			checkAnswer(sessionId, 'people:' + guess, (obj, addSuggestions) => {
				let responseText = obj.ssml;
				let rempromptText;
				responseText = removeSpeakTags(responseText);
				let questionText = obj.displayText;

				let handlerState;
				let increment = false;
				const cardData = {};
				let responseTemplate = null;
				let currentQuestion = this.attributes.currentQuestion;

				if (obj.question) {
					handlerState = GAME_STATES.QUIZ;
					responseText = responseText + obj.question.ssml;
					rempromptText = obj.question.ssml;
					const questionItems = obj.question.chips;
					const cardDisplayText = `
                            Q${currentQuestion}. ${obj.speech}
                            <br/>
                            <br/>
                            Q${currentQuestion + 1}. ${
						obj.question.questionText
					}
                        `;
					let questionTitle = `Question ${currentQuestion + 1}`;
					responseTemplate = createQuestionTemplate.call(
						this,
						questionTitle,
						cardDisplayText,
						questionItems,
						obj.image
					);

					const cardBody = convertQuestionSpeechToCardText(obj.question.ssml);
					const cardBodyPre = obj.speech.replace('Correct! ', '');

					cardData.title = 'Correct';
					cardData.body = cardBodyPre + ' ' + cardBody;
					cardData.image = obj.image;

					increment = true;
				} else {
					let richTextResponse = `<font size = '3'>${responseText}</font><br/><br/><font size = '2'>${
						obj.score
					}</font>`;
					responseText = responseText + ' ' + obj.score;
					rempromptText = speech['ASK_NEW_GAME'];
					handlerState = GAME_STATES.START;
					richTextResponse = richTextResponse.replace(
						' start a new game?',
						":<br/><action value='new_game'> • Start a New game</action><br/><action value='exit_game'> • Exit</action>"
					);
					const templateBuilder = new Alexa.templateBuilders.BodyTemplate2Builder();
					obj.image = obj.image ? obj.image : process.env.FT_LOGO;
					responseTemplate = templateBuilder
						.setToken('IncorrectAnswerView')
						.setTitle('Incorrect Answer')
						.setTextContent(TextUtils.makeRichText(richTextResponse))
						.setImage(ImageUtils.makeImage(obj.image))
						.setBackButtonBehavior('HIDDEN')
						.build();
					cardData.title = 'Incorrect';
					cardData.body = obj.speech;
					cardData.image = obj.image;
				}
				callback(
					responseText,
					rempromptText,
					handlerState,
					cardData,
					increment,
					responseTemplate
				);
			});
		} else {
			// Response misunderstood
			let responseText = responses.misunderstood(
				true,
				guess,
				expectedAnswers,
				seed
			).ssml;
			responseText = removeSpeakTags(responseText);
			let rempromptText = responseText;

			let handlerState = GAME_STATES.QUIZ;

			spoor({
				category: 'GAME',
				action: 'answermisunderstood',
				system: {
					source: 'ftlabs-correlations-game',
					route: 'alexa'
				},
				context: {
					product: 'ftlabs',
					sessionId: sessionId,
					input: guessValue,
					expectedInput: JSON.stringify(expectedAnswers)
				}
			});

			console.log(
				`INFO: route=alexa; action=answermisunderstood; sessionId=${sessionId};`
			);
			callback(responseText, rempromptText, handlerState, false, false);
		}
	});
}

function getExpectedAnswers(session) {
	return games.check(session).then(gameIsInProgress => {
		if (gameIsInProgress) {
			return games.get(session).then(data => data);
		} else {
			return [];
		}
	});
}

function checkAnswer(session, answer, callback) {
	games.answer(session, answer).then(result => {
		spoor({
			category: 'GAME',
			action: 'answergiven',
			system: {
				source: 'ftlabs-correlations-game',
				route: 'alexa'
			},
			context: {
				product: 'ftlabs',
				sessionId: session
			}
		});

		if (result.correct === true) {
			console.log(
				`INFO: route=alexa; action=answergiven; sessionId=${session}; result=correct; score=${
					result.score
				};`
			);
			spoor({
				category: 'GAME',
				action: 'answergiven_correct',
				system: {
					source: 'ftlabs-correlations-game',
					route: 'alexa'
				},
				context: {
					product: 'ftlabs',
					sessionId: session,
					score: result.score
				}
			});
			getQuestion(session, obj => {
				callback(
					responses.correctAnswer(result.linkingArticles[0], obj, {
						submitted: result.submittedAnswer,
						seed: result.seedPerson
					}),
					true
				);
			});
		} else {
			console.log(
				`INFO: route=alexa; action=answergiven; sessionId=${session}; result=incorrect; score=${
					result.score
				}; globalHighestScore=${
					result.globalHighestScore
				}; achievedHighestScoreFirst=${result.achievedHighestScoreFirst};`
			);
			spoor({
				category: 'GAME',
				action: 'answergiven_incorrect',
				system: {
					source: 'ftlabs-correlations-game',
					route: 'alexa'
				},
				context: {
					product: 'ftlabs',
					sessionId: session,
					score: result.score
				}
			});
			callback(
				responses.incorrectAnswer(
					{ expected: result.expected, seed: result.seedPerson },
					result.linkingArticles[0],
					{
						score: result.score,
						scoreMax: result.globalHighestScore,
						first: result.achievedHighestScoreFirst
					}
				),
				false
			);
		}
	});
}

function guessIsInAnswerList(guess, expectedAnswers) {
	return (
		guess.toLowerCase() === expectedAnswers[0].match ||
		guess.toLowerCase() === expectedAnswers[1].match ||
		guess.toLowerCase() === expectedAnswers[2].match
	);
}

function matchAndGetOriginalAnswer(guess, expectedAnswers) {
	let original;
	if (guess.toLowerCase() === expectedAnswers[0].match) {
		original = expectedAnswers[0].original;
	} else if (guess.toLowerCase() === expectedAnswers[1].match) {
		original = expectedAnswers[1].original;
	} else {
		original = expectedAnswers[2].original;
	}
	return original;
}

function removeSpeakTags(ssml) {
	return ssml.replace('<speak>', '').replace('</speak>', '');
}

function convertQuestionSpeechToCardText(questionSpeech) {
	let cardText = striptags(questionSpeech).trim();
	cardText = cardText.replace(/ +(?= )/g, '');
	cardText = cardText.replace('one)', '1)');
	cardText = cardText.replace('two)', '2)');
	cardText = cardText.replace('three)', '3)');
	return cardText;
}

/**
 * Check if the Alexa suports render templates (Has Display)
 */
function supportsDisplay() {
	const hasDisplay =
		this.event.context &&
		this.event.context.System &&
		this.event.context.System.device &&
		this.event.context.System.device.supportedInterfaces &&
		this.event.context.System.device.supportedInterfaces.Display;
	return hasDisplay;
}

/**
 * Check if the simulator is making the request.
 */
function isSimulator() {
	return !this.event.context; //simulator doesn't send context
}

/**
 * Creates the Help Template
 */
function createHelpTemplate(title, text) {
	let builder = new Alexa.templateBuilders.BodyTemplate1Builder();
	builder
		.setTitle(title)
		.setToken('HelpTemplate')
		.setTextContent(TextUtils.makeRichText(text))
		.setBackButtonBehavior('HIDDEN');
	return builder.build();
}

/**
 * Creates the question template for the echo show
 * If an article image is set, then it will treat this as a Question Answer page else
 * it will default to a plain Question page.
 * TODO: Refactor
 * @param {*} headerText - Title text
 * @param {*} listItems - Array of strings to display
 */
function createQuestionTemplate(
	headerText,
	bodyText,
	answerOptions,
	articleImage = null
) {
	bodyText = bodyText.replace('Correct!', '<b>Correct!</b>');
	let templateText = `${bodyText}<br/>`;
	let builder, fontSize;
	const includesAnswerContent = articleImage != null;
	if (includesAnswerContent) {
		builder = new Alexa.templateBuilders.BodyTemplate2Builder();
		builder.setImage(ImageUtils.makeImage(articleImage));
		fontSize = 2;
	} else {
		builder = new Alexa.templateBuilders.BodyTemplate1Builder();
		fontSize = 4;
		templateText += '<br/>';
	}
	for (let i in answerOptions) {
		let questionNum = parseInt(i) + 1;
		templateText += `<action value='${questionNum}'>
                        <b>${questionNum}).</b> ${answerOptions[i]}
                        </action><br/>`;
	}
	templateText = `<font size = '${fontSize}'>${templateText}</font>`;
	builder
		.setTitle(headerText)
		.setToken('QuestionTemplate')
		.setTextContent(TextUtils.makeRichText(templateText))
		.setBackButtonBehavior('HIDDEN');
	return builder.build();
}

router.post('/', (request, response) => {
	//Compare app ID with env app ID (Part of alexa specification)
	let requestAppId = request.body.session.application.applicationId;
	if (requestAppId != APP_ID && !IS_TEST_MODE) {
		response.sendStatus(401);
		return;
	}
	// Dummy context for Alexa handler
	const context = {
		fail: () => {
			// Fail with internal server error
			response.sendStatus(500);
		},
		succeed: data => {
			response.send(data);
		}
	};

	const alexa = Alexa.handler(request.body, context);
	alexa.appId = process.env.APP_ID;
	alexa.registerHandlers(
		newSessionHandlers,
		startStateHandlers,
		quizStateHandlers,
		helpStateHandlers
	);
	alexa.execute();
});

module.exports.router = router;
