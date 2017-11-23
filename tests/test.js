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
*/
