const debug = require('debug')('responses:content');

function inputWasNotUnderstood(isRepeating, input = null, options = null){
	let phrase;

	if(isRepeating) {
		phrase = `Sorry, I heard ${input}. The possible answers were: `;
		for(let i = 0; i < options.length; ++i) {
			phrase += `${(i + 1)}) ${options[i]}. `;
		}

	} else {
		phrase = `Sorry, I'm not sure what you said. For instructions, say "help".`;
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
		speech : `Correct. They were connected in the FT article, titled: ${articleHeadline}. ${newQuestion.speech}`,
		ssml : `<speak>Correct. They were connected in the FT article, titled: ${articleHeadline}. <break time="1s"/> ${newQuestion.ssml.replace('<speak>', '')}`
	};

}

function theAnswerGivenWasNotCorrect(expectedAnswer, articleHeadline){

	const textPhrase  = `Sorry, that is incorrect. The correct answer was ${expectedAnswer}. They were connected in the FT article: ${articleHeadline}.`;
	const voicePhrase = `Sorry, that is incorrect. The correct answer was ${expectedAnswer}. They were connected in the FT article, titled: ${articleHeadline}.`;

	return {
		displayText : textPhrase,
		speech : voicePhrase,
		ssml : `<speak>${voicePhrase}</speak>`
	};

}

function askThePlayerAQuestion(data){
	const phrase = `Who was mentioned in a recent article with ${data.seed.printValue}?`;
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

	const phrase = 'You have reached the end of the chain. There are no more connections to be made.';

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
