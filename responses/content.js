const debug = require('debug')('responses:content');

function inputWasNotUnderstood(isRepeating, input = null, options = null){
	let phrase;

	if(isRepeating) {
		phrase = `Sorry, I heard ${input}. The possible answers were: `;
		for(let i = 0; i < options.length; ++i) {
			phrase += `${(i + 1)}) ${options[i]}. `;
		}

	} else {
		phrase = `Sorry, I'm not quite sure what you mean. Say "help" for instructions.`;
	}

	return {
		displayText : phrase,
		speech : phrase,
		ssml : `<speak>${phrase}</speak>`
	};

}

function theAnswerGivenWasCorrect(articleHeadline, newQuestion){

	return {
		displayText : `Correct. They were connected in the FT article: ${articleHeadline}. ${newQuestion.displayText}`,
		speech : `Correct. They were connected in the FT article: ${articleHeadline}. ${newQuestion.speech}`,
		ssml : `<speak>Correct. They were connected in the FT article: ${articleHeadline}. <break time="1s"/> ${newQuestion.ssml.replace('<speak>', '')}`
	};

}

function theAnswerGivenWasNotCorrect(expectedAnswer, articleHeadline){

	const phrase = `Sorry, that is incorrect. The correct answer was ${expectedAnswer}. They were connected in the FT article ${articleHeadline}.`

	return {
		displayText : phrase,
		speech : phrase,
		ssml : `<speak>${phrase}</speak>`
	};

}

function askThePlayerAQuestion(data){
	const phrase = `Who was recently mentioned in an article with ${data.seed.printValue}?`;
	let displayText = phrase + ' ';
	let ssml = `<speak>${phrase}`;

	Object.keys(data.options).forEach((key, index) => {
		displayText += (index + 1) + ') ' + data.options[key].printValue + '. ';
		ssml += '<break time="1s"/>' + (index + 1) + ') ' + data.options[key].printValue + '. ';
	});

	ssml += '</speak>';

	return {
		displayText: displayText,
		speech : displayText,
		ssml: ssml
	};

}

function theGameHasBeenWon(){

	const phrase = 'You won. There are no more connections to be made in this sequence.';

	return {
		displayText : phrase,
		speech : phrase,
		ssml : `<speak>${phrase}</speak>`
	};
}

module.exports = {
	misunderstood : inputWasNotUnderstood,
	correctAnswer : theAnswerGivenWasCorrect,
	incorrectAnswer : theAnswerGivenWasNotCorrect,
	askQuestion : askThePlayerAQuestion,
	win : theGameHasBeenWon
};