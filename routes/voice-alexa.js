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
    'AMAZON.YesIntent': function() {
        this.emit('StartGame');
    },
    'AMAZON.NoIntent': function() {
        this.emit(':tell', 'Ok, see you next time!');
    },
    'StartGame': function() {
        const sessionId = this.event.session.sessionId;

        games.check(sessionId)
        .then(gameIsInProgress => {
            if (gameIsInProgress) {
                return games.question(sessionId);
            } else {
                return games.new(sessionId)
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
            console.log(question);

            // need to remove this for now as response.speak adds the speak tags
            question = question.replace("<speak>", "").replace("</speak>", "");

            console.log(question);

            this.response.speak(question);   
            this.emit(':responseReady');        
        })
        .catch(err => {
            console.log('HANDLED REJECTION', err);
        })
        ;
    }
});

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
    alexa.registerHandlers(newSessionHandlers, startStateHandlers);
    alexa.execute();
});

module.exports = router;
