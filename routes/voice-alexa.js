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
        this.emit(':ask', 'Are you ready to make connections?');
    },
    'AMAZON.YesIntent': function () {
        this.emit('StartGame');
    },
    'AMAZON.NoIntent': function () {
        this.emit(':tell', 'Ok, see you next time!');
    },
    'StartGame': function() {
        const sessionId = this.event.session.sessionId;

        getQuestion(sessionId, (question => {
            this.handler.state = GAME_STATES.QUIZ;        
            this.response.speak(question);   
            this.emit(':responseReady');        
        }));
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
    
            const expectedAnswers = Object.keys(answers).map(key => {
                answers[key] = {original: answers[key].replace('people:', ''), match: answers[key].replace('people:', '').replace('.', '').replace('-', ' ')}
                return answers[key];
            });

            // Convert from number to answer
            if (guess) {
                guess = expectedAnswers[parseInt(guess) - 1].match;
            }

            console.log(guessIndex);
            console.log(guess);

            checkAnswer(sessionId, 'people:' + guess, (obj, addSuggestions) => {
                let richResponse = obj.ssml;
                richResponse = richResponse.replace("<speak>", "").replace("</speak>", "");
                                
                this.response.speak(`You said the answer was ${guessIndex} - ${guess}! ` + richResponse);           
                this.emit(':responseReady');       
            });     
        })    
    }
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
                }, inputType);
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
    alexa.registerHandlers(newSessionHandlers, startStateHandlers, quizStateHandlers);
    alexa.execute();
});

module.exports = router;
