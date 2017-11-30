'use strict';
require('dotenv').load();
const helper = require('./helpers/test-helper');
const RequestBuilder = require('./helpers/request-builder');
const alexaSkill = require('../routes/voice-alexa.js');

const exampleModel = "tests/models/example.json";


// Define functions and function mapping for skill tree

const stringToFunction = {
    "correctAnswer": correctAnswer,
    "incorrectAnswer": incorrectAnswer,
    "misunderstoodAnswer": misunderstoodAnswer
};

function correctAnswer(outputSpeech) {
    const speech = helper.processSpeech(outputSpeech);
    const possiblePeople = helper.getPeopleFromQuestion(speech);
    return helper.getCorrectAnswer(possiblePeople.personX, possiblePeople.people);
}

function incorrectAnswer(outputSpeech) {
    const speech = helper.processSpeech(outputSpeech);
    const possiblePeople = helper.getPeopleFromQuestion(speech);
    return helper.getIncorrectAnswer(possiblePeople.personX, possiblePeople.people);
}

function misunderstoodAnswer(outputSpeech) {
    return "NOT AN ANSWER";
}



function getSimpleNode(node) {
    let simpleNode = {
        type: node.requestType
    };
    if (node.name) {
        simpleNode.name = node.name
    }
    if (node.slots) {
        simpleNode.slots = node.slots;
    }
    if (node.shouldEndSession) {
        simpleNode.shouldEndSession = node.shouldEndSession;
    }
    return simpleNode;
}

function traverseTree(node) {
    let paths = [];
    traverse(node, [], paths);
    return paths;
}

function traverse(node, path, paths) {
    if (node.children) {
        for (let childNode of node.children) {
            let newPath = path.slice();
            newPath.push(getSimpleNode(node));
            traverse(childNode, newPath, paths);
        }
    } else {
        path.push(getSimpleNode(node));
        paths.push(path);
    }
}

async function testSkillTree(skillTreeJson, handler) {
    const json = await helper.getInteractionModelFromJSON(skillTreeJson);
    const model = JSON.parse(json);

    const paths = traverseTree(model);  
    
    const info = {
        applicationId: 'amzn1.echo-sdk-ams.app.123',
        userId: 'test-user',
        requestId: 'request-id-1234',
        locale: 'en-GB',
        newSession: true
    };

    return Promise.all(paths.map((path, i) => {
        const session = {
            sessionId: (i + '').padStart(4, "0")
        };
        return testPath(path, handler, info, session);
    }));
}

async function testPath(path, handler, info, session) {
    let attributes = {};
    
    for (let i = 0; i < path.length; i++) {
        let node = path[i];
        if (node.type !== "LaunchRequest") {
            info.newSession = false;
        }
        if (node.slots) {
            const functionName = node.slots.Answer.value.function;
            const answerValue = await stringToFunction[functionName](attributes.speechOutput);
            node.slots.Answer.value = answerValue;
        }
        const newRequest = helper.buildRequest(info, session, attributes, node);
        const response = await helper.sendRequest(newRequest, handler);
        attributes = response.sessionAttributes;

        if (node.shouldEndSession) {
            if (response.response.shouldEndSession) {
                return "Session Ended As Expected"
            } else {
                return "Error: Session Did Not End As Expected"
            }
        }
        if (i === path.length - 1) {
            return "Branch Ended";
        }
    }
}

testSkillTree(exampleModel, alexaSkill.handler)
    .then(response => {
        console.log(response);
    })
