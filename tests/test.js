require('dotenv').load();

const correlations_service = require('../bin/lib/correlations');

const conversation = require('alexa-conversation');
const app = require('../routes/voice-alexa.js');

const opts = { 
    name: 'Test Conversation',
    appId: 'test-app-id',
    app: app
};

function getCorrectAnswer(personX, people) {
    return correlations_service.calcChainLengthsFrom(`people:${personX}`)
        .then(result => {
            let directConnections;
            for (let r of result) {
                if (r.links === 1) directConnections = r.entities;
            }
            directConnections = directConnections.map(p => p.replace('people:', ''));
            for (const p of people) {
                if (directConnections.includes(p)) return p;
            }
        });
}

function getPeopleFromQuestion(question) {
    const reX = /Question [0-9]+\. (.*?) was mentioned/;
    const resultX = reX.exec(question);

    const reOne = /one\) (.*?)\./;
    const resultOne = reOne.exec(question);

    const reTwo = /two\) (.*?)\./;
    const resultTwo = reTwo.exec(question);

    const reThree = /three\) (.*?)\./;
    const resultThree = reThree.exec(question);
    
    return {
        personX: resultX[1],
        people: [
            resultOne[1],
            resultTwo[1],
            resultThree[1]
        ]
    };
}

/* 
    How to get a correct answer from the correlations service

    const questionExample = `Question 1. Robert Mugabe was mentioned in a recent article with which one of the following people? one) Morgan Tsvangirai. two) Sean Hannity. three) Roy Moore.`;
    const extractedPeople = getPeopleFromQuestion(questionExample);
    getCorrectAnswer(extractedPeople.personX, extractedPeople.people)
        .then(answer => {
            console.log(answer);
        });
*/

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
