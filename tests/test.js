require('dotenv').load();

const helper = require('./test-helper');

const alexaSkill = require('../routes/voice-alexa.js');

/* 
    How to get a correct answer from the correlations service

    const questionExample = `Question 1. Robert Mugabe was mentioned in a recent article with which one of the following people? one) Morgan Tsvangirai. two) Sean Hannity. three) Roy Moore.`;
    const extractedPeople = helper.getPeopleFromQuestion(questionExample);
    helper.getCorrectAnswer(extractedPeople.personX, extractedPeople.people)
        .then(answer => {
            console.log(answer);
        });

    Send a request 

    helper.sendRequest(request, alexaSkill.handler)
        .then(response => {
            console.log(response);
        })
*/

const launchRequest = {
    "session": {
      "attributes": {},
      "sessionId": "1234",
      "application": {
        "applicationId": "amzn1.echo-sdk-ams.app.123"
      },
      "user": {
        "userId": "test_user"
      },
      "new": true
    },
    "request": {
      "type": "LaunchRequest",
      "locale": "en-GB",
      "requestId": "request_id_123",
      "timestamp": 1449829632387
    }
  }

helper.sendRequest(launchRequest, alexaSkill.handler)
    .then(response => {
        console.log(response);
    })
