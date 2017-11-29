'use strict';
require('dotenv').load();
const helper = require('./helpers/test-helper');
const RequestBuilder = require('./helpers/request-builder');
const alexaSkill = require('../routes/voice-alexa.js');

const exampleModel = "tests/models/example.json";

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
    
    for (let node of path) {
        console.log(node.type, node.name);
        if (node.type !== "LaunchRequest") {
            info.newSession = false;
        }
        const newRequest = helper.buildRequest(info, session, attributes, node);
        const response = await helper.sendRequest(newRequest, handler);
        attributes = response.sessionAttributes;
    }

    // return previousResponse;
}

// async function testNode(node, handler, info, session, attributes) {    
//     // Create request info object
//     const request = {
//         type: node.requestType
//     };

//     if (node.name) {
//         request.name = node.name;
//     }
//     if (node.slots) {
//         request.slots = {
//             Answer: 0
//         }
//     }

//     const newRequest = helper.buildRequest(info, session, attributes, request);
    
//     const response = await helper.sendRequest(newRequest, handler);
//     const updatedAttributes = response.sessionAttributes;

//     console.log(node.requestType, node.name);

//     if (response.response.shouldEndSession) {
//         return response;
//     } else {
//         return Promise.all(node.children.map(n => {
//             return testNode(n, handler, info, session, updatedAttributes);
//         }));
//     }
// };

testSkillTree(exampleModel, alexaSkill.handler)
    .then(response => {
        console.log(response);
    })
