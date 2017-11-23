const correlations_service = require('../bin/lib/correlations');

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

function sendRequest(event, handler) {
    return new Promise((resolve, reject) => {
        handler(event, {
            succeed: resolve,
            fail: reject
        });
    });
}

module.exports = {
    getCorrectAnswer,
    getPeopleFromQuestion,
    sendRequest
}
