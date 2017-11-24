require('dotenv').load();
const helper = require('./test-helper');
const RequestBuilder = require('./request-builder');

const alexaSkill = require('../routes/voice-alexa.js');

function randomNumber() {
    return Math.floor(Math.random() * 9999);
}

async function testIntents(modelFilename, handler) {
    let model = await helper.getInteractionModelFromJSON(modelFilename);
    let parsed = JSON.parse(model);
    const intents = parsed.languageModel.intents;
    let promises = [];
    for (let i of intents) {
        // Need to have a different request builder for each intent
        const requestBuilder = new RequestBuilder({
            applicationId: 'amzn1.echo-sdk-ams.app.123',
            sessionId: randomNumber(),
            userId: 'test-user',
            requestId: 'request-id-1234',
            locale: 'en-GB'
        });
        const launchRequest = requestBuilder.buildRequest();
        const request = requestBuilder.buildRequest(i.name);
        const requestWithLaunch = helper.sendRequest(launchRequest, handler)
            .then(response => {
                requestBuilder.updateAttributes(response.sessionAttributes);
                return helper.sendRequest(request, handler);
            })
        promises.push(requestWithLaunch);
    }
    return Promise.all(promises);
}

testIntents('./modelling/model.json', alexaSkill.handler)
    .then(responses => {
        for (let r of responses) {
            const speech = r.response.outputSpeech.ssml;
            const processedSpeech = helper.processSpeech(speech);
            console.log(processedSpeech);
        }
    });


