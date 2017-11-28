require('dotenv').load();
const helper = require('./test-helper');
const RequestBuilder = require('./request-builder');

const alexaSkill = require('../routes/voice-alexa.js');

const maxDepth = 1;

const requestBuilder = new RequestBuilder({
    applicationId: 'amzn1.echo-sdk-ams.app.123',
    sessionId: `0000`,    
    userId: 'test-user',
    requestId: 'request-id-1234',
    locale: 'en-GB'
});

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

    const requestMetaInfo = {
        sessionId: `0000`
    };

    return testIntent(
        responseTree.root, 
        null, 
        "LaunchRequest", 
        intents, 
        requestMetaInfo,
        null,
        0, 
        handler
    );
}

async function testIntent(parentNode, previousResponse, intentName, listOfIntents, requestMetaInfo, sessionAttributes, depth, handler) {
    if (intentName === "LaunchRequest") {
        const launchRequest = requestBuilder.buildRequest();
        return helper.sendRequest(launchRequest, handler)
            .then(response => {
                const responseSpeech = helper.processSpeech(response.response.outputSpeech.ssml).trim();                
                return Promise.all(listOfIntents.map((intent, index) => {
                    const requestMetaInfo = {
                        sessionId: `111${index}`
                    };
                    return testIntent(
                        parentNode, 
                        responseSpeech, 
                        intent.name, 
                        listOfIntents, 
                        requestMetaInfo,
                        response.sessionAttributes, 
                        depth + 1, 
                        handler
                    );
                }));
            })
            .then(responses => {
                parentNode.children = responses;
                return parentNode;
            });
    } else {
        let intentRequest;
        if (intentName === "AnswerIntent" && previousResponse.includes('Question')) {
            const extractedPeople = helper.getPeopleFromQuestion(previousResponse);
            const correctAnswer = await helper.getCorrectAnswer(extractedPeople.personX, extractedPeople.people);
            const slots = [{
                name: 'Answer',
                value: correctAnswer
            }];
            intentRequest = requestBuilder.buildRequest(intentName, slots, sessionAttributes, requestMetaInfo);                        
        } else {
            intentRequest = requestBuilder.buildRequest(intentName, null, sessionAttributes, requestMetaInfo);                        
        }
        return helper.sendRequest(intentRequest, handler)
            .then(response => {
                const responseSpeech = helper.processSpeech(response.response.outputSpeech.ssml).trim();
                // Check if the session should end or we have reached max depth
                if (response.response.shouldEndSession || 
                    depth === maxDepth ||
                    responseSpeech.includes('Sorry')) 
                {
                    console.log(`Session Ended: ${intentName}, ${requestMetaInfo.sessionId}`);
                    return {
                        intentType: "IntentRequest",
                        intentName: intentName,
                        responseSpeech: responseSpeech
                    };
                } else {
                    return Promise.all(listOfIntents.map(intent => {
                        return testIntent(
                            parentNode, 
                            responseSpeech, 
                            intent.name, 
                            listOfIntents, 
                            requestMetaInfo,
                            response.sessionAttributes,
                            depth + 1,
                            handler
                        );
                    }))
                    .then(nodes => {
                        return {
                            intentType: "IntentRequest",
                            intentName: intentName,
                            responseSpeech: responseSpeech,
                            children: nodes
                        }
                    });
                }
            });
    }
}

testIntents('./modelling/model.json', alexaSkill.handler)
    .then(result => {
        console.log(result);
    });


