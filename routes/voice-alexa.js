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

const APP_ID = process.env.APP_ID;

const spoor = require('../bin/lib/log-to-spoor');

const GAME_STATES = {
    START: '_STARTMODE',
    QUIZ: '_QUIZMODE',
    HELP: '_HELPMODE'
};

const speech = {
    'WELCOME': 'Welcome to Make Connections, an FT Labs game. For instructions, say "help". Shall we start playing?',
    'ENDGAME': 'Thank you for playing. There are new connections everyday.',
    'UNHANDLED': `Sorry, I did not understand that. For instructions, use "Help".`,   
    'START_UNHANDLED': `Sorry, I did not understand that. Say "yes" to start a new game. For instructions, use "Help".`,
    'QUIZ_UNHANDLED': `Sorry, I did not understand that. Try selecting numbers instead of names. For instructions, use "Help".`,
    'HELP_UNHANDLED': `Sorry, I did not understand that. Say "yes" to return to an active game. For instructions, use "Help".`,
    'ASK_CONTINUE': 'Would you like to continue your game?',
    'ASK_NEW_GAME': 'Would you like to start a new game?'
}

const newSessionHandlers = {
    'LaunchRequest': function () {
        this.handler.state = GAME_STATES.START;
        this.emitWithState('WelcomeGame', true);
    },
    'StartGame': function () {
        this.handler.state = GAME_STATES.START;
        this.emitWithState('StartGame', true);
    },
    'AMAZON.StartOverIntent': function () {
        this.handler.state = GAME_STATES.START;
        this.emitWithState('WelcomeGame', true);
    },
    'AMAZON.HelpIntent': function () {
        this.handler.state = GAME_STATES.HELP;
        this.emitWithState('helpTheUser', true);
    },
    'Unhandled': function () {
        this.response.speak(speech['UNHANDLED']).listen(speech['UNHANDLED']);        
        this.emit(':responseReady');
    }
};

const startStateHandlers = Alexa.CreateStateHandler(GAME_STATES.START, {
    'WelcomeGame': function () {
        this.emit(':ask', speech['WELCOME']);
    },
    'AMAZON.YesIntent': function () {
        this.emit('StartGame');
    },
    'AMAZON.NoIntent': function () {
        this.response.speak(speech['ENDGAME']);
        const cardTitle = 'Goodbye';
        const cardBody = speech['ENDGAME'];
        this.response.cardRenderer(cardTitle, cardBody);        
        this.emit(':responseReady');
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', speech['ENDGAME']);        
    },
    'AMAZON.HelpIntent': function () {
        this.handler.state = GAME_STATES.HELP;
        this.emitWithState('helpTheUser', true);
    },
    "ElementSelected" : function() {
        // We will look for the value in this.event.request.token in the AnswerIntent call to compareSlots
        console.log("in ElementSelected QUIZ state");
        this.emitWithState("AnswerIntent");
    },
    'StartGame': function() {
        this.emitWithState("QuestionIntent");        
    },
    'Unhandled': function () {
        this.response.speak(speech['START_UNHANDLED']).listen(speech['START_UNHANDLED']);        
        this.emit(':responseReady');      
    }        
});

const quizStateHandlers = Alexa.CreateStateHandler(GAME_STATES.QUIZ, {

    'QuestionIntent': function() {
        const sessionId = this.event.session.sessionId;
        getQuestion(sessionId, (question => {
            const questionSpeech = question.ssml;
            const questionItems = question.chips;
            const questionText = question.questionText;

            this.handler.state = GAME_STATES.QUIZ;        

            Object.assign(this.attributes, {
                'speechOutput': questionSpeech,
                'currentQuestion': 1
            });

            //Simple Card content
            const cardTitle = `Question ${this.attributes.currentQuestion}:`;
            const cardBody = convertQuestionSpeechToCardText(questionSpeech);
            //End Simple Card

            //Template Content (Echo show)
            if(supportsDisplay.call(this)||isSimulator.call(this)) {
                const listItemBuilder = new Alexa.templateBuilders.ListItemBuilder();
                const listTemplateBuilder = new Alexa.templateBuilders.ListTemplate1Builder();
                for (let item of questionItems) {
                    listItemBuilder.addItem(null, item, TextUtils.makeRichText(`<font size = '5'>${item}</font>`));
                }
                const listItems = listItemBuilder.build();
                const listTemplate = listTemplateBuilder.setToken('MultipleChoiceListView')
                                                        .setTitle(questionText)
                                                        .setListItems(listItems)
                                                        .build();
                this.response.speak(questionSpeech)
                                        .cardRenderer(cardTitle, cardBody)
                                        .renderTemplate(listTemplate)
                                        .listen(questionSpeech)
                this.emit(':responseReady');                
              } else {
                // Only render simple card
                this.response.cardRenderer(cardTitle, cardBody);
                this.response.speak(questionSpeech).listen(questionSpeech);                
                this.emit(':responseReady');
              }     
        }));
    },

    'AnswerIntent': function () {
        if (typeof this.event.request.intent.slots.Answer.value !== "undefined") {            
            const sessionId = this.event.session.sessionId;        
            const guessValue = this.event.request.intent.slots.Answer.value;
            const currentQuestion = this.attributes['currentQuestion'];

            checkGuess(sessionId, guessValue, currentQuestion, 
                ((response, reprompt, state, card, increment, responseTemplate) => {

                if (card) {
                    card.image = card.image.replace('http', 'https');
                    var imageObj = {
                        smallImageUrl: card.image,
                        largeImageUrl: card.image
                    };
                    this.response.cardRenderer(card.title, card.body, imageObj);
                }

                if (increment) {
                    Object.assign(this.attributes, {
                        'speechOutput': reprompt,
                        'currentQuestion': this.attributes['currentQuestion'] + 1
                    });
                }
                 
                this.handler.state = state;

                if((supportsDisplay.call(this)||isSimulator.call(this))
                 && responseTemplate) {
                    this.response.renderTemplate(responseTemplate);
                }

                this.response.speak(response).listen(reprompt);   
                this.emit(':responseReady');
            }));
        } else {
            this.handler.state = GAME_STATES.QUIZ;
            this.emitWithState('Unhandled', true);
        }
    },   
    'AMAZON.RepeatIntent': function () {
        this.response.speak(this.attributes['speechOutput']).listen(this.attributes['speechOutput']);

        const cardTitle = 'Question Repeated';
        const cardBody = convertQuestionSpeechToCardText(this.attributes['speechOutput']);

        this.response.cardRenderer(cardTitle, cardBody);
        this.emit(':responseReady');
    },
    'AMAZON.HelpIntent': function () {
        this.handler.state = GAME_STATES.HELP;
        this.emitWithState('helpTheUser', true);
    },
    'AMAZON.CancelIntent': function () {
        const sessionId = this.event.session.sessionId;
        
        games.interrupt(sessionId).then(data => {
            const response = responses.stop(true, {score: data.score, scoreMax: data.globalHighestScore, first: data.achievedHighestScoreFirst});
            this.response.speak(response.speech);
            const cardTitle = 'Goodbye';
            const cardBody = removeSpeakTags(response.speech);
            this.response.cardRenderer(cardTitle, cardBody); 
            this.emit(':responseReady');
        });    
    },
    'AMAZON.StartOverIntent': function () {
        const sessionId = this.event.session.sessionId;        
        
        this.handler.state = GAME_STATES.START;
        games.interrupt(sessionId).then(data => {
            this.emitWithState('StartGame', true);        
        });
    },
    'AMAZON.StopIntent': function () {
        this.handler.state = GAME_STATES.HELP;
        this.response.speak(speech['ASK_CONTINUE']).listen(speech['ASK_CONTINUE']);
        const cardTitle = 'Paused'
        this.response.cardRenderer(cardTitle, speech['ASK_CONTINUE']);
        this.emit(':responseReady');
    },
    'Unhandled': function () {
        this.response.speak(speech['QUIZ_UNHANDLED']).listen(speech['QUIZ_UNHANDLED']);        
        this.emit(':responseReady');
    }
});

const helpStateHandlers = Alexa.CreateStateHandler(GAME_STATES.HELP, {
    'helpTheUser': function () {
        const sessionId = this.event.session.sessionId;
        
        const helpBody = games.check(sessionId)
        .then(gameIsInProgress => {
            let helpResponse = responses.help(gameIsInProgress).ssml;
            helpResponse = removeSpeakTags(helpResponse);   
            
            const cardTitle = 'Help';
            const cardBody = responses.help(gameIsInProgress).displayText;
            
            this.response.cardRenderer(cardTitle, cardBody); 
            
            if (gameIsInProgress) {
                this.response.speak(helpResponse).listen(speech['ASK_CONTINUE']);        
            } else {
                this.response.speak(helpResponse).listen(speech['ASK_NEW_GAME']);
            }

            spoor({
                'category': 'GAME',
                'action': 'useraskedforhelp',
                'system' : {
                    'source': 'ftlabs-correlations-game',
                    'route': 'alexa'
                },
                'context' : {
                    'product': 'ftlabs',
                    'sessionId': sessionId
                }
            });
            
            console.log(`INFO: route=alexa; action=useraskedforhelp; sessionId=${sessionId};`);            
            this.emit(':responseReady');  
        });      
    },
    'AMAZON.YesIntent': function () {
        if (this.attributes['speechOutput']) {
            this.handler.state = GAME_STATES.QUIZ;
            this.emitWithState('AMAZON.RepeatIntent');
        } else {
            this.handler.state = GAME_STATES.START;        
            this.emitWithState('StartGame', true);
        }
    },
    'AMAZON.CancelIntent': function () {
        this.emit('AMAZON.NoIntent');        
    },
    'AMAZON.NoIntent': function () {
        const sessionId = this.event.session.sessionId;
        
        games.check(sessionId)
            .then(gameIsInProgress => {
                if (gameIsInProgress) {
                    games.interrupt(sessionId).then(data => {
                        const response = responses.stop(true, {score: data.score, scoreMax: data.globalHighestScore, first: data.achievedHighestScoreFirst});
                        
                        spoor({
                            'category': 'GAME',
                            'action': 'gameinterrupted',
                            'system' : {
                                'source': 'ftlabs-correlations-game',
                                'route': 'alexa'
                            },
                            'context' : {
                                'product': 'ftlabs',
                                'sessionId': sessionId,
                                'latestScore' : data.score,
                                'globalHighestScore' : data.globalHighestScore,
                                'achievedHighestScoreFirst' : data.achievedHighestScoreFirst
                            }
                        });

                        console.log(`INFO: route=alexa; action=gameinterrupted; sessionId=${sessionId}; latestScore=${data.score}; globalHighestScore=${data.globalHighestScore}; achievedHighestScoreFirst=${data.achievedHighestScoreFirst}`);            
                        this.response.speak(response.speech);
                        const cardTitle = 'Goodbye';
                        const cardBody = removeSpeakTags(response.speech);
                        this.response.cardRenderer(cardTitle, cardBody); 
                        this.emit(':responseReady');
                    });
                } else {
                    console.log(`INFO: route=alexa; action=gameinterrupted; sessionId=${sessionId}`);
                    this.response.speak(speech['ENDGAME']);
                    const cardTitle = 'Goodbye';
                    const cardBody = speech['ENDGAME'];
                    this.response.cardRenderer(cardTitle, cardBody); 
                    this.emit(':responseReady');
                }
            });
    },
    'Unhandled': function () {
        this.response.speak(speech['HELP_UNHANDLED']).listen(speech['HELP_UNHANDLED']);        
        this.emit(':responseReady');
    }
});

function getQuestion(session, callback) {
    games.check(session)
    .then(gameIsInProgress => {
        if (gameIsInProgress) {
            spoor({
				'category': 'GAME',
				'action': 'questionasked',
				'system' : {
                    'source': 'ftlabs-correlations-game',
                    'route': 'alexa'
				},
				'context' : {
					'product': 'ftlabs',
					'sessionId': session
				}
            });
            
            console.log(`INFO: route=alexa; action=questionasked; sessionId=${session};`);                                
            return games.question(session);
        } else {
            spoor({
				'category': 'GAME',
				'action': 'gamestarted',
				'system' : {
                    'source': 'ftlabs-correlations-game',
                    'route': 'alexa'
				},
				'context': {
					'product': 'ftlabs',
					'sessionId': session
				}
            });
            
            console.log(`INFO: route=alexa; action=gamestarted; sessionId=${session};`);            
            return games.new(session)
            .then(gameUUID => {
                return gameUUID;
            })
            .then(gameUUID => games.question(gameUUID))
            ;
        }
    })
    .then(data => {
        if (data.limitReached === true) {
            // Connection limit met
            spoor({
				'category': 'GAME',
				'action': 'gamewon',
				'system' : {
                    'source': 'ftlabs-correlations-game',
                    'route': 'alexa'
				},
				'context' : {
					'product': 'ftlabs',
					'sessionId': session,
					'score': data.score
				}
            });
            
            console.log(`INFO: route=alexa; action=gamewon; sessionId=${session}; score=${data.score}`);            
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
            
            let question = responses.askQuestion(preparedData, data.questionNum);
            question.ssml = removeSpeakTags(question.ssml);
    
            callback(question);
        }
    })
    .catch(err => {
        console.log('HANDLED REJECTION', err);
    })
    ;
}

function checkGuess(sessionId, guessValue, currentQuestion, callback) {
    let guess = guessValue;   

    getExpectedAnswers(sessionId)
    .then(data => {            
        const answers = data.answersReturned;
        const seed = data.seedPerson;
        
        let expectedAnswers;
        if (typeof answers[0] === 'string' || answers[0] instanceof String) {
            expectedAnswers = Object.keys(answers).map(key => {
                answers[key] = {
                    original: answers[key].replace('people:', ''), 
                    match: answers[key].replace('people:', '').replace('.', '').replace('-', ' ').toLowerCase()
                };
                return answers[key];
            });
        } else {
            expectedAnswers = answers;
        }

        if ((parseInt(guessValue) >= 0 && parseInt(guessValue) <= 3) || 
            guessIsInAnswerList(guess, expectedAnswers)) {
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
        
                let handlerState;
                let increment = false;
                const cardData = {};
                let responseTemplate = null;

                if (obj.question) {                        
                    handlerState = GAME_STATES.QUIZ;                     
                    responseText = responseText + obj.question;
                    rempromptText = obj.question;

                    const cardBody = convertQuestionSpeechToCardText(obj.question);
                    const cardBodyPre = obj.speech.replace('Correct! ', '');

                    cardData.title = 'Correct';
                    cardData.body = cardBodyPre + ' ' + cardBody; 
                    cardData.image = obj.image;
                        
                    increment = true;
                } else {
                    const richTextResponse = 
                    `<font size = '3'>${responseText}</font>
                    <br/><br/><font size = '2'>${obj.score}</font>`;                    
                    responseText = responseText + ' ' + obj.score;
                
                    rempromptText = speech['ASK_NEW_GAME'];
                    handlerState = GAME_STATES.START;    

                    const templateBuilder = new Alexa.templateBuilders.BodyTemplate2Builder;
                    responseTemplate = templateBuilder.setToken('IncorrectAnswerView')
                                            .setTitle('Incorrect Answer')
                                            .setTextContent(TextUtils.makeRichText(richTextResponse))
                                            .setImage(ImageUtils.makeImage(obj.image))
                                            .build();    

                    cardData.title = 'Incorrect'
                    cardData.body = obj.speech;
                    cardData.image = obj.image;
                }

                callback(responseText, rempromptText, handlerState, cardData, increment, responseTemplate);
            });      
        } else {
            // Response misunderstood
            let responseText = responses.misunderstood(true, guess, expectedAnswers, seed).ssml;
            responseText = removeSpeakTags(responseText);       
            let rempromptText = responseText;

            let handlerState = GAME_STATES.QUIZ;  

            spoor({
				'category': 'GAME',
				'action': 'answermisunderstood',
				'system' : {
                    'source': 'ftlabs-correlations-game',
                    'route': 'alexa'
				},
				'context' : {
					'product': 'ftlabs',
					'sessionId': sessionId,
					'input' : guessValue,
					'expectedInput': JSON.stringify(expectedAnswers)
				}
			});
            
            console.log(`INFO: route=alexa; action=answermisunderstood; sessionId=${sessionId};`);                  
            callback(responseText, rempromptText, handlerState, false, false);
        }  
    });
}

function getExpectedAnswers(session) {
	return games.check(session)
	.then(gameIsInProgress => {
		if(gameIsInProgress) {
			return games.get(session).then(data => data);
		} else {
			return [];
		}
	});
}

function checkAnswer(session, answer, callback) {
    games.answer(session, answer)
        .then(result => {
            spoor({
                'category': 'GAME',
                'action': 'answergiven',
                'system' : {
                    'source': 'ftlabs-correlations-game',
                    'route': 'alexa'
                },
                'context' : {
                    'product': 'ftlabs',
                    'sessionId': session
                }
            });

            if(result.correct === true){
                console.log(`INFO: route=alexa; action=answergiven; sessionId=${session}; result=correct; score=${result.score};`);
                spoor({
					'category': 'GAME',
					'action': 'answergiven_correct',
					'system' : {
                        'source': 'ftlabs-correlations-game',
                        'route': 'alexa'
					},
					'context' : {
						'product': 'ftlabs',
						'sessionId': session,
						'score': result.score 
					}
				});                
                getQuestion(session, obj => {
                    callback(responses.correctAnswer(result.linkingArticles[0], obj.ssml, {submitted : result.submittedAnswer, seed : result.seedPerson}), true);
                });
            } else {
                console.log(`INFO: route=alexa; action=answergiven; sessionId=${session}; result=incorrect; score=${result.score}; globalHighestScore=${result.globalHighestScore}; achievedHighestScoreFirst=${result.achievedHighestScoreFirst};`); 
                spoor({
					'category': 'GAME',
					'action': 'answergiven_incorrect',
					'system' : {
                        'source': 'ftlabs-correlations-game',
                        'route': 'alexa'
					},
					'context' : {
						'product': 'ftlabs',
						'sessionId': session,
						'score': result.score 
					}
				});                
                callback(responses.incorrectAnswer({expected : result.expected, seed : result.seedPerson}, result.linkingArticles[0], {score: result.score, scoreMax: result.globalHighestScore, first: result.achievedHighestScoreFirst}), false);
            }
        })
    ;
}

function guessIsInAnswerList(guess, expectedAnswers) {
    return guess.toLowerCase() === expectedAnswers[0].match ||
    guess.toLowerCase() === expectedAnswers[1].match ||
    guess.toLowerCase() === expectedAnswers[2].match;
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
      this.event.context.System.device.supportedInterfaces.Display
  
    return hasDisplay;
}
  
function isSimulator() {
     const isSimulator = !this.event.context; //simulator doesn't send context
    return isSimulator;
}

function renderListTemplate(content) {
    let response = {
                    "template": {
                        "type": "ListTemplate1",
                        "title": content.listTemplateTitle,
                        "token": content.templateToken,
                        "listItems": content.listItems,
                        "backButton": "HIDDEN"
                    }
    }
    return response 
}










router.post('/', (request, response) => {

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
    alexa.registerHandlers(newSessionHandlers, startStateHandlers, quizStateHandlers, helpStateHandlers);
    alexa.execute();
});

module.exports.router = router;
