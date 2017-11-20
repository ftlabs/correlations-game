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

const speech = {
    'WELCOME': 'Welcome to Make Connections, an FT Labs game. For instructions, say "help". Shall we start playing?',
    'ENDGAME': 'Thank you for playing. There are new connections everyday.',
    'UNHANDLED': `Sorry, I did not understand that. For instructions, use "Help".`,   
    'START_UNHANDLED': `Sorry, I did not understand that. Say "yes" to start a new game. For instructions, use "Help".`,
    'QUIZ_UNHANDLED': `Sorry, I did not understand that. Try selecting numbers instead of names. For instructions, use "Help".`,
    'HELP_UNHANDLED': `Sorry, I did not understand that. Say "start" to return to an active game. For instructions, use "Help".`,
    'CONTINUE': 'Would you like to continue your game?'
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
        this.emit(':tell', speech['ENDGAME']);
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
        this.response.speak(speech['START_UNHANDLED']).listen(speech['START_UNHANDLED']);        
        this.emit(':responseReady');      
    }        
});

const quizStateHandlers = Alexa.CreateStateHandler(GAME_STATES.QUIZ, {
    'AnswerIntent': function () {       
        if (typeof this.event.request.intent.slots.Answer.value !== "undefined") {            
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
                        answers[key] = {
                            original: answers[key].replace('people:', ''), 
                            match: answers[key].replace('people:', '').replace('.', '').replace('-', ' ').toLowerCase()
                        };
                        return answers[key];
                    });
                } else {
                    expectedAnswers = answers;
                }

                if ((parseInt(guessIndex) >= 0 && parseInt(guessIndex) <= 3) ||
                    guess.toLowerCase() === expectedAnswers[0].match ||
                    guess.toLowerCase() === expectedAnswers[1].match ||
                    guess.toLowerCase() === expectedAnswers[2].match
                ) {
                    if (parseInt(guessIndex) >= 0 && parseInt(guessIndex) <= 3) {
                        guess = expectedAnswers[parseInt(guess) - 1].original;                    
                    } else {
                        // Look into a way that this code can be simplified
                        if (guess.toLowerCase() === expectedAnswers[0].match) {
                            guess = expectedAnswers[0].original;  
                        } else if (guess.toLowerCase() === expectedAnswers[1].match) {
                            guess = expectedAnswers[1].original; 
                        } else {
                            guess = expectedAnswers[2].original; 
                        }
                    }
                    
                    checkAnswer(sessionId, 'people:' + guess, (obj, addSuggestions) => {
                        let richResponse = obj.ssml;
                        richResponse = removeSpeakTags(richResponse);
                        
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
                    richResponse = removeSpeakTags(richResponse);       

                    this.handler.state = GAME_STATES.QUIZ;        
                    this.response.speak(richResponse).listen(richResponse);   
                    this.emit(':responseReady');                 
                }  
            });
        } else {
            this.handler.state = GAME_STATES.QUIZ;
            this.emitWithState('Unhandled', true);
        }
    },   
    'AMAZON.RepeatIntent': function () {
        this.response.speak(this.attributes['speechOutput']).listen(this.attributes['speechOutput']);
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
            this.emit(':tell', response.speech);
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
        this.response.speak(speech['CONTINUE']).listen(speech['CONTINUE']);
        this.emitWithState(':responseReady', true);
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
            this.emit(':ask', helpResponse);  
        });      
    },
    'AMAZON.YesIntent': function () {
        if (this.attributes['speechOutput'] && this.attributes['repromptText']) {
            this.handler.state = GAME_STATES.QUIZ;
            this.emitWithState('AMAZON.RepeatIntent');
        } else {
            this.handler.state = GAME_STATES.START;        
            this.emitWithState('StartGame', true);
        }
    },
    'AMAZON.NoIntent': function () {
        const sessionId = this.event.session.sessionId;
        
        games.interrupt(sessionId).then(data => {
            const response = responses.stop(true, {score: data.score, scoreMax: data.globalHighestScore, first: data.achievedHighestScoreFirst});
            this.emit(':tell', response.speech);
        }); 
    },
    'Unhandled': function () {
        this.response.speak(speech['HELP_UNHANDLED']).listen(speech['HELP_UNHANDLED']);        
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
            // Connection limit met
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
            
            let questionText = responses.askQuestion(preparedData, data.questionNum).ssml;
            questionText = removeSpeakTags(questionText);
    
            callback(questionText);
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

function removeSpeakTags(ssml) {
    return ssml.replace('<speak>', '').replace('</speak>', '');
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
