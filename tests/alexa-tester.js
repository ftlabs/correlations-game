require('dotenv').load();
const helper = require('./test-helper');
const RequestBuilder = require('./request-builder');

const alexaSkill = require('../routes/voice-alexa.js');

const maxDepth = 3;

async function testIntents(modelFilename, handler) {
    // Load model from json file
    const model = await helper.getInteractionModelFromJSON(modelFilename);
    // Parse model
    const parsed = JSON.parse(model);
    const intents = parsed.languageModel.intents;    
    // Intialise tree
    let responseTree = {
        root: {
            intentType: "LaunchRequest",
            intentName: "N/A",
            children: []
        }
    };
    // Call testIntent with LaunchRequest and list of intents, requestBuilder, and the handler
    const requestBuilder = new RequestBuilder({
            applicationId: 'amzn1.echo-sdk-ams.app.123',
            sessionId: ("0").repeat(4),
            userId: 'test-user',
            requestId: 'request-id-1234',
            locale: 'en-GB'
    });
    return testIntent(responseTree.root, "LaunchRequest", intents, requestBuilder, 0, handler);
}

async function testIntent(treeNode, intentName, listOfIntents, requestBuilder, depth, handler) {
    if (intentName === "LaunchRequest") {
        const launchRequest = requestBuilder.buildRequest();
        return helper.sendRequest(launchRequest, handler)
            .then(response => {
                requestBuilder.updateAttributes(response.sessionAttributes);
                return Promise.all(listOfIntents.map(intent => {
                    return testIntent(treeNode, intent.name, listOfIntents, requestBuilder, depth + 1, handler);
                }));
            })
            .then(responses => {
                treeNode.children = responses;
                return treeNode;
            });
    } else {
        const intentRequest = requestBuilder.buildRequest(intentName);
        return helper.sendRequest(intentRequest, handler)
            .then(response => {
                if (response.response.shouldEndSession || depth === maxDepth) {
                    return {
                        intentType: "IntentRequest",
                        intentName: intentName
                    };
                } else {
                    requestBuilder.updateAttributes(response.sessionAttributes);
                    return {
                        intentType: "IntentRequest",
                        intentName: intentName,
                        children: Promise.all(listOfIntents.map(intent => {
                            return testIntent(treeNode, intentName, listOfIntents, requestBuilder, depth + 1, handler);
                        }))
                    }
                }
            });
    }
}

testIntents('./modelling/model.json', alexaSkill.handler)
    .then(result => {
        console.log(result);
    });

