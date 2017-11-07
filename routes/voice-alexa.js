'use strict';
const debug = require('debug')('correlations-game:routes:voice');
const express = require('express');
const router = express.Router();
const games = require('../bin/lib/game');
const responses = require('../responses/content');
const Alexa = require('alexa-sdk');

const handlers = {
    'HelloWorldIntent': function () {
        var guessNum = parseInt(this.event.request.intent.slots.number.value);
        this.emit(':tell', `Hello, you guessed ${guessNum}!`);
    }
};

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
    alexa.registerHandlers(handlers);
    alexa.execute();
});

module.exports = router;
