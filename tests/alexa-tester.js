'use strict';
require('dotenv').load();
const helper = require('./helpers/test-helper');
const RequestBuilder = require('./helpers/request-builder');
const alexaSkill = require('../routes/voice-alexa.js');

const exampleModel = "tests/models/example.json";

async function testSkillTree(skillTreeJson, handler) {
    const json = await helper.getInteractionModelFromJSON(skillTreeJson);
    const model = JSON.parse(json);

    const info = {
        applicationId: 'amzn1.echo-sdk-ams.app.123',
        userId: 'test-user',
        requestId: 'request-id-1234',
        locale: 'en-GB',
        newSession: true
    };
    const session = {
        sessionId: '0000'
    };
    const attributes = {};

    return testNode(model, handler, info, session, attributes);
}

async function testNode(node, handler, info, session, attributes) {    
    // Create request info object
    const request = {
        type: node.requestType
    };
    if (node.name) {
        request.name = node.name;
    }
    if (node.slots) {
        request.slots = {
            Answer: 0
        }
    }

    const newRequest = helper.buildRequest(info, session, attributes, request);
    
    return helper.sendRequest(newRequest, handler);
};

testSkillTree(exampleModel, alexaSkill.handler)
    .then(response => {
        console.log(response);
    })
