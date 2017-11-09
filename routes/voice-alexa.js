'use strict';
const debug = require('debug')('correlations-game:routes:voice');
const express = require('express');
const router = express.Router();
const games = require('../bin/lib/game');
const responses = require('../responses/content');
const Alexa = require('alexa-sdk');

const GAME_STATES = {
    START: '_STARTMODE',
    HELP: '_HELPMODE'
};

const newSessionHandlers = {
    'LaunchRequest': function () {
        this.handler.state = GAME_STATES.START;
        this.emitWithState('WelcomeGame', true);
    },
    'AMAZON.StartOverIntent': function () {
        this.handler.state = GAME_STATES.START;
        this.emitWithState('StartGame', true);
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
        this.response.speak('Let’s play! Say “start” when ready or help for more instructions.');
        this.emit(':responseReady');
    },
    'StartGame': function() {
        const sessionId = this.event.session.sessionId;

        games.check(sessionId);
        games.new(sessionId);

        this.response.speak('Thanks for playing!');
        this.emit(':responseReady');
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
