'use strict';
const debug = require('debug')('correlations-game:routes:voice');
const express = require('express');
const router = express.Router();
const games = require('../bin/lib/game');
const responses = require('../responses/content');
const Alexa = require('alexa-sdk');

const GAME_STATES = {
    START: '_STARTMODE',
    QUIZ: '_QUIZMODE',
    HELP: '_HELPMODE'
};

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
        const speechOutput = 'Say start to start a new game.';
        this.response.speak(speechOutput).listen(speechOutput);
        this.emit(':responseReady');
    }
};

const startStateHandlers = Alexa.CreateStateHandler(GAME_STATES.START, {
    'WelcomeGame': function () {
        this.emit(':ask', 'Shall we start playing?');
    },
    'AMAZON.YesIntent': function () {
        this.emit('StartGame');
    },
    'AMAZON.NoIntent': function () {
        this.emit(':tell', 'Ok, see you next time!');
    },
    'AMAZON.HelpIntent': function () {
        this.handler.state = GAME_STATES.HELP;
        this.emitWithState('helpTheUser', true);
    },
    'StartGame': function() {
        const sessionId = this.event.session.sessionId;

        getQuestion(sessionId, (question => {
            this.handler.state = GAME_STATES.QUIZ;        
            this.response.speak(question).listen(question); 
            Object.assign(this.attributes, {
                'speechOutput': question,
                'currentQuestion': 1
            });
            this.emit(':responseReady');        
        }));
    },
    'Unhandled': function () {
        const speechOutput = 'Say yes to start a new game.';
        this.response.speak(speechOutput).listen(speechOutput);
        this.emit(':responseReady');        
    }        
});

const quizStateHandlers = Alexa.CreateStateHandler(GAME_STATES.QUIZ, {
    'AnswerIntent': function () {
        const sessionId = this.event.session.sessionId;        
        const guessIndex = this.event.request.intent.slots.Answer.value;
        let guess = guessIndex;   

        getExpectedAnswers(sessionId)
        .then(data => {            
            const answers = data.answersReturned;
            const seed = data.seedPerson;
            
            let expectedAnswers;
            if (typeof answers[0] === 'string' || answers[0] instanceof String) {
                expectedAnswers = Object.keys(answers).map(key => {
                    answers[key] = {original: answers[key].replace('people:', ''), match: answers[key].replace('people:', '').replace('.', '').replace('-', ' ')}
                    return answers[key];
                });
            } else {
                expectedAnswers = answers;
            }

            if (parseInt(guessIndex) >= 0 && parseInt(guessIndex) <= 3) {
                guess = expectedAnswers[parseInt(guess) - 1].match;
                
                checkAnswer(sessionId, 'people:' + guess, (obj, addSuggestions) => {
                    let richResponse = obj.ssml;
                    richResponse = richResponse.replace("<speak>", "").replace("</speak>", "");
                    
                    const cardTitle = `Question ${this.attributes['currentQuestion']}`;
                    const cardBody = obj.displayText + ' ' + obj.article;
                    this.response.cardRenderer(cardTitle, cardBody, obj.image);                                                          
                    
                    if (obj.question) {                        
                        this.handler.state = GAME_STATES.QUIZ; 
                        Object.assign(this.attributes, {
                            'speechOutput': obj.question,
                            'currentQuestion': this.attributes['currentQuestion'] + 1
                        });
                        this.response.speak(richResponse + obj.question).listen(obj.question);
                        this.emit(':responseReady');                       
                    } else {
                        const repromptText = 'Would you like to start a new game?';
                        richResponse = richResponse + ' ' + obj.score;
                        this.handler.state = GAME_STATES.START;      
                        this.response.speak(richResponse).listen(repromptText);   
                        this.emit(':responseReady');
                    }
                });   
            } else {                
                // Response misunderstood
                let richResponse = responses.misunderstood(true, guess, expectedAnswers, seed).ssml;
                richResponse = richResponse.replace("<speak>", "").replace("</speak>", "");                

                this.handler.state = GAME_STATES.QUIZ;        
                this.response.speak(richResponse).listen(richResponse);   
                this.emit(':responseReady');                 
            }  
        });    
    },   
    'AMAZON.RepeatIntent': function () {
        // Need to add a different reprompt text
        this.response.speak(this.attributes['speechOutput']).listen(this.attributes['speechOutput']);
        this.emit(':responseReady');
    },
    'AMAZON.HelpIntent': function () {
        this.handler.state = GAME_STATES.HELP;
        this.emitWithState('helpTheUser', true);
    },
    'AMAZON.CancelIntent': function () {
        const cancelSpeech = 'Thank you for playing. There are new connections everyday.'
        this.response.speak(cancelSpeech).listen(cancelSpeech);
        this.emit(':responseReady');
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
        const speechOutput = 'Would you like to continue your game?';
        this.response.speak(speechOutput).listen(speechOutput);
        this.emitWithState(':responseReady', true);
    },
    'Unhandled': function () {
        // Need to add unhandled text to remprompt and make it obvious you were not understood
        const unhandledSpeech = "Sorry, I'm not sure what you said. For instructions, use 'Help'.";
        this.response.speak(unhandledSpeech).listen(unhandledSpeech);        
        this.emit(':responseReady');
    }
});

const helpStateHandlers = Alexa.CreateStateHandler(GAME_STATES.HELP, {
    'helpTheUser': function () {
        const sessionId = this.event.session.sessionId;
        
        const helpBody = games.check(sessionId)
        .then(gameIsInProgress => {
            let helpBody = responses.help(gameIsInProgress).ssml;
            helpBody = helpBody.replace("<speak>", "").replace("</speak>", "");            
            this.emit(':ask', helpBody);  
        });      
    },
    'AMAZON.YesIntent': function () {
        // If already in a game, continue
        if (this.attributes['speechOutput'] && this.attributes['repromptText']) {
            this.handler.state = GAME_STATES.QUIZ;
            this.emitWithState('AMAZON.RepeatIntent');
        } else {
            this.handler.state = GAME_STATES.START;        
            this.emitWithState('StartGame', true);
        }
    },
    'AMAZON.NoIntent': function () {
        this.emit(':tell', 'Ok, see you next time!');
    },
    'Unhandled': function () {
        const speechOutput = 'Say yes to continue, or no to end the game.'
        this.response.speak(speechOutput).listen(speechOutput);
        this.emit(':responseReady');
    },
});

function getQuestion(session, callback) {
    games.check(session)
    .then(gameIsInProgress => {
        if (gameIsInProgress) {
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
        if (data.limitReached === true) {
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
            
            var question = responses.askQuestion(preparedData, data.questionNum).ssml;
            // need to remove this for now as response.speak adds the speak tags
            question = question.replace("<speak>", "").replace("</speak>", "");
    
            callback(question);
        }
    })
    .catch(err => {
        console.log('HANDLED REJECTION', err);
    })
    ;
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
            if(result.correct === true){
                getQuestion(session, obj => {
                    callback(responses.correctAnswer(result.linkingArticles[0], obj, {submitted : result.submittedAnswer, seed : result.seedPerson}), true);
                });
            } else {
                callback(responses.incorrectAnswer({expected : result.expected, seed : result.seedPerson}, result.linkingArticles[0], {score: result.score, scoreMax: result.globalHighestScore, first: result.achievedHighestScoreFirst}), false);
            }
        })
    ;
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

module.exports = router;
