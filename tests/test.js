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
    .end();
