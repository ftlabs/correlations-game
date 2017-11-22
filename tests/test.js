require('dotenv').load();

const conversation = require('alexa-conversation');
const app = require('../routes/voice-alexa.js');

const opts = { 
    name: 'Test Conversation',
    appId: 'test-app-id',
    app: app
};


conversation(opts)
    .userSays('LaunchRequest')
        .plainResponse
            .shouldContain('Welcome')
    .userSays('AMAZON.YesIntent')
        .plainResponse
            .shouldMatch(/Question 1\. [^.]* was mentioned in a recent article with which one of the following people\? one\) [^.]*\.  two\) [^.]*\.  three\) [^.]*\. /)
    .userSays('AnswerIntent', {Answer: '4'})
        .plainResponse
            .shouldMatch(/ Sorry, I did not understand that\. Try selecting numbers instead of names\.  For [^.]*, the possible answers were: one, [^.]*\. two, [^.]*\. three, [^.]*\. /)        
    .end();
